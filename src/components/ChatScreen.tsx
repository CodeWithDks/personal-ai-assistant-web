import { Bot, Mic, MessageCircle, SendHorizontal, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string; time: string };

const MOCK_REPLIES = [
  "Noted. Here's a simple way to approach it: break it into three small steps, start with the easiest one, and check back in once it's done.",
  "Good question. Based on what you've shared, I'd prioritise the task with the nearest deadline and park the rest in your notes for later.",
  "Understood. I can help you turn that into a checklist once task syncing is connected. For now, here's a quick summary of your idea.",
  "That sounds like a solid plan. One suggestion: block 25 focused minutes for it today, then reassess.",
];

const timeNow = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [recording, setRecording] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const replyIndex = useRef(0);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, thinking]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [thinking]);

  const send = (event?: FormEvent) => {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || thinking) return;
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", content: text, time: timeNow() }]);
    setDraft("");
    setRecording(false);
    setThinking(true);
    window.setTimeout(() => {
      const reply = MOCK_REPLIES[replyIndex.current++ % MOCK_REPLIES.length];
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", content: reply, time: timeNow() }]);
      setThinking(false);
    }, 1200);
  };

  const clear = () => {
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
        {empty ? (
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
                    {m.content}
                  </div>
                  <p className="mt-1 px-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{m.role === "user" ? "You" : "Assistant"} · {m.time}</p>
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
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Message your assistant…"
              aria-label="Message"
              className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
            />
            <Button type="button" variant="outline" size="icon" aria-pressed={recording} aria-label={recording ? "Stop recording" : "Start voice input"} onClick={() => setRecording((r) => !r)} className={cn("relative shrink-0 transition-transform active:scale-95", recording && "border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:text-destructive-foreground")}>
              {recording && <span className="absolute inset-0 animate-ping rounded-md bg-destructive/40" />}
              <Mic className="relative" />
            </Button>
            <Button type="submit" size="icon" aria-label="Send message" disabled={thinking || !draft.trim()} className="shrink-0 transition-transform active:scale-95">
              <SendHorizontal />
            </Button>
          </div>
        </div>
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
