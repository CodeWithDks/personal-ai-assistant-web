import { useQueryClient } from "@tanstack/react-query";
import { Bot, Mic, MessageCircle, Pause, Play, SendHorizontal, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { FormEvent, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChatSkeleton, ErrorNotice, useMockLoading } from "@/components/StatusBlocks";
import { ApiError, TIMEOUT_STATUS, sendChat, sendVoice } from "@/lib/api";
import { NOTES_KEY } from "@/hooks/use-notes";
import { TASKS_KEY } from "@/hooks/use-tasks";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string; time: string; voice?: boolean; audio?: string | undefined; error?: { message: string; detail?: string | undefined; offline: boolean } | undefined };

const TIMEOUT_DETAIL = "It may have finished part of your request. Check your Tasks and Notes before retrying.";

const MAX_LEN = 2000;
const COUNTER_AT = 1800;

const MAX_RECORD_MS = 60_000;
const MIN_RECORD_MS = 1_000;
const MIME_CHOICES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

const timeNow = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const loading = useMockLoading();
  const [thinking, setThinking] = useState(false);
  const [recording, setRecording] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();
  const runId = useRef(0);
  const [voiceError, setVoiceError] = useState<{ message: string; detail?: string | undefined; offline: boolean } | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const discardRef = useRef(false);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingId(null);
  };

  const playAudio = (id: string, src: string) => {
    stopAudio();
    const audio = new Audio(src);
    audioRef.current = audio;
    audio.onended = () => { if (audioRef.current === audio) { audioRef.current = null; setPlayingId(null); } };
    setPlayingId(id);
    audio.play().catch(() => { if (audioRef.current === audio) { audioRef.current = null; setPlayingId(null); } });
  };

  const togglePlay = (m: ChatMessage) => {
    if (!m.audio) return;
    if (playingId === m.id) stopAudio();
    else playAudio(m.id, m.audio);
  };

  const releaseMic = () => {
    clearTimeout(stopTimer.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  };

  useEffect(() => () => {
    discardRef.current = true;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    releaseMic();
    audioRef.current?.pause();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, thinking]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [thinking]);

  const refreshLists = () => {
    void queryClient.invalidateQueries({ queryKey: TASKS_KEY });
    void queryClient.invalidateQueries({ queryKey: NOTES_KEY });
  };

  const ask = async (userId: string, text: string) => {
    const run = ++runId.current;
    setThinking(true);
    try {
      const { reply } = await sendChat(text);
      if (run !== runId.current) return;
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", content: reply ?? "", time: timeNow() }]);
      refreshLists();
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      if (status >= 500 || status === TIMEOUT_STATUS) refreshLists();
      if (run !== runId.current) return;
      const message = err instanceof Error ? err.message : "Request failed. Please try again.";
      const detail = status === TIMEOUT_STATUS ? TIMEOUT_DETAIL : undefined;
      setMessages((m) => m.map((x) => (x.id === userId ? { ...x, error: { message, detail, offline: status === 0 } } : x)));
    } finally {
      if (run === runId.current) setThinking(false);
    }
  };

  const askVoice = async (blob: Blob, filename: string) => {
    const run = ++runId.current;
    setThinking(true);
    try {
      const res = await sendVoice(blob, filename);
      if (run !== runId.current) return;
      const assistantId = crypto.randomUUID();
      const audio = res.audio_base64 ? `data:audio/mpeg;base64,${res.audio_base64}` : undefined;
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "user", content: res.transcript ?? "", time: timeNow(), voice: true },
        { id: assistantId, role: "assistant", content: res.reply ?? "", time: timeNow(), audio },
      ]);
      refreshLists();
      if (audio) playAudio(assistantId, audio);
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      if (status >= 500 || status === TIMEOUT_STATUS) refreshLists();
      if (run !== runId.current) return;
      setVoiceError({
        message: err instanceof Error ? err.message : "Request failed. Please try again.",
        detail: status === TIMEOUT_STATUS ? TIMEOUT_DETAIL : undefined,
        offline: status === 0,
      });
    } finally {
      if (run === runId.current) setThinking(false);
    }
  };

  const startRecording = async () => {
    stopAudio();
    setVoiceError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceError({ message: "Voice recording isn't supported in this browser.", offline: false });
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      setVoiceError({
        message: name === "NotAllowedError" || name === "SecurityError"
          ? "Microphone access was denied. Allow it in your browser settings and try again."
          : "Couldn't access the microphone. Please try again.",
        offline: false,
      });
      return;
    }
    const mimeType = MIME_CHOICES.find((t) => MediaRecorder.isTypeSupported(t));
    let recorder: MediaRecorder;
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      setVoiceError({ message: "Voice recording isn't supported in this browser.", offline: false });
      return;
    }
    const chunks: Blob[] = [];
    const startedAt = Date.now();
    discardRef.current = false;
    streamRef.current = stream;
    recorderRef.current = recorder;
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      releaseMic();
      setRecording(false);
      if (discardRef.current) return;
      if (Date.now() - startedAt < MIN_RECORD_MS) {
        setVoiceError({ message: "Recording too short, hold on a bit longer.", offline: false });
        return;
      }
      const type = recorder.mimeType || mimeType || "audio/webm";
      const ext = type.includes("mp4") ? "mp4" : "webm";
      void askVoice(new Blob(chunks, { type }), `recording.${ext}`);
    };
    recorder.start();
    setRecording(true);
    stopTimer.current = setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, MAX_RECORD_MS);
  };

  const toggleRecording = () => {
    if (thinking) return;
    const rec = recorderRef.current;
    if (rec && rec.state === "recording") rec.stop();
    else void startRecording();
  };

  const send = (event?: FormEvent) => {
    event?.preventDefault();
    const text = draft.trim().slice(0, MAX_LEN);
    if (!text || thinking) return;
    const id = crypto.randomUUID();
    setMessages((m) => [...m, { id, role: "user", content: text, time: timeNow() }]);
    setDraft("");
    setVoiceError(null);
    void ask(id, text);
  };

  const retry = (msg: ChatMessage) => {
    if (thinking) return;
    setMessages((m) => m.map((x) => (x.id === msg.id ? { ...x, error: undefined } : x)));
    void ask(msg.id, msg.content);
  };

  const clear = () => {
    runId.current++;
    stopAudio();
    setVoiceError(null);
    setMessages([]);
    setThinking(false);
  };

  const empty = messages.length === 0 && !thinking;

  return (
    <div className="flex h-[calc(100dvh-15rem)] min-h-[26rem] w-full flex-col lg:h-[calc(100dvh-13.5rem)]">
      {!empty && (
        <div className="flex items-center justify-between pb-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{messages.length} message{messages.length === 1 ? "" : "s"}</span>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={clear}>
            <Trash2 /> Clear conversation
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pr-1" aria-live="polite">
        {loading ? (
          <ChatSkeleton />
        ) : empty ? (
          <div className="animate-mode-enter flex h-full items-center justify-center text-center">
            <div className="max-w-md">
              <div className="mx-auto flex size-20 items-center justify-center rounded-full border border-border bg-surface-raised shadow-sm">
                <MessageCircle className="size-8 text-primary" strokeWidth={1.5} />
              </div>
              <h2 className="mt-7 font-display text-3xl font-semibold sm:text-4xl">A clear space to think</h2>
              <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">Ask a question, plan your day, or think out loud. Your assistant is ready when you are.</p>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-4 py-2">
            {messages.map((m) => (
              <div key={m.id} className={cn("animate-mode-enter flex gap-3", m.role === "user" ? "justify-end" : "justify-start")}>
                {m.role === "assistant" && <AssistantAvatar />}
                <div className={cn("max-w-[85%] sm:max-w-[75%]", m.role === "user" && "text-right")}>
                  <div className={cn("rounded-lg px-4 py-3 text-left text-sm leading-6 whitespace-pre-wrap", m.role === "user" ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm border border-border bg-muted font-mono text-[13px] text-foreground")}>
                    {m.role === "assistant" ? <ReplyMarkdown text={m.content} /> : m.voice ? (
                      <span className="inline-flex items-start gap-1.5"><Mic className="mt-1 size-3 shrink-0 opacity-80" aria-label="Voice message" />{m.content}</span>
                    ) : m.content}
                    {m.audio && (
                      <button type="button" onClick={() => togglePlay(m)} aria-label={playingId === m.id ? "Pause reply audio" : "Play reply audio"} className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-background/70 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-primary transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        {playingId === m.id ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                        {playingId === m.id ? "Pause" : "Play"}
                      </button>
                    )}
                  </div>
                  <p className="mt-1 px-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{m.role === "user" ? "You" : "Assistant"} · {m.time}</p>
                  {m.error && (
                    <div className="mt-2 text-left">
                      <ErrorNotice variant={m.error.offline ? "offline" : "error"} title={m.error.message} body={m.error.detail} onRetry={() => retry(m)} />
                    </div>
                  )}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="animate-mode-enter flex gap-3" role="status">
                <AssistantAvatar />
                <div className="flex items-center gap-2 rounded-lg rounded-bl-sm border border-border bg-muted px-4 py-3 font-mono text-xs text-muted-foreground">
                  <span className="flex gap-1">
                    {[0, 150, 300].map((d) => (
                      <span key={d} className="size-1.5 animate-bounce rounded-full bg-primary" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </span>
                  Assistant is thinking…
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <form onSubmit={send} className="mx-auto mt-4 w-full max-w-3xl">
        {voiceError && (
          <div className="mb-3">
            <ErrorNotice variant={voiceError.offline ? "offline" : "error"} title={voiceError.message} body={voiceError.detail} />
          </div>
        )}
        <div className={cn("rounded-lg border bg-card p-2 shadow-sm transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring/20", recording ? "border-destructive/60" : "border-border")}>
          {recording && (
            <div className="animate-form-swap flex items-center gap-2 px-2 pt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-destructive" role="status">
              <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-75" /><span className="relative size-2 rounded-full bg-destructive" /></span>
              Recording…
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              value={draft}
              maxLength={MAX_LEN}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Message your assistant…"
              aria-label="Message"
              className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
            />
            <Button type="button" variant="outline" size="icon" aria-pressed={recording} aria-label={recording ? "Stop recording" : "Start voice input"} disabled={thinking} onClick={toggleRecording} className={cn("relative shrink-0 transition-transform active:scale-95", recording && "border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:text-destructive-foreground")}>
              {recording && <span className="absolute inset-0 animate-ping rounded-md bg-destructive/40" />}
              <Mic className="relative" />
            </Button>
            <Button type="submit" size="icon" aria-label="Send message" disabled={thinking || recording || !draft.trim()} className="shrink-0 transition-transform active:scale-95">
              <SendHorizontal />
            </Button>
          </div>
        </div>
        {draft.length > COUNTER_AT && (
          <p className={cn("mt-1 text-right font-mono text-[10px] tracking-[0.12em]", draft.length >= MAX_LEN ? "text-destructive" : "text-muted-foreground")} aria-live="polite">{draft.length} / {MAX_LEN}</p>
        )}
        <p className="mt-2 text-center font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Enter to send · Shift + Enter for a new line</p>
      </form>
    </div>
  );
}

function AssistantAvatar() {
  return (
    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
      <Bot className="size-4" />
    </span>
  );
}

/** Safe Markdown: react-markdown never renders raw HTML (no rehype-raw), so reply text can't inject markup. */
function ReplyMarkdown({ text }: { text: string }) {
  return (
    <div className="space-y-2 whitespace-normal [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc [&_strong]:font-semibold">
      <ReactMarkdown
        skipHtml
        components={{
          p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
          a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer noopener" className="text-primary underline underline-offset-2">{children}</a>,
          code: ({ children, className }) =>
            className ? <code className={className}>{children}</code> : <code className="rounded-sm bg-background/70 px-1 py-0.5">{children}</code>,
          pre: ({ children }) => <pre className="overflow-x-auto rounded-md border border-border bg-background/70 p-3 text-[12px] leading-5">{children}</pre>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
