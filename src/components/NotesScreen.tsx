import { CalendarDays, Check, ChevronDown, Loader2, ChevronLeft, ChevronRight, NotebookPen, Pencil, Plus, Search, SearchX, Trash2, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ErrorNotice, FieldError, ListSkeleton } from "@/components/StatusBlocks";
import { NOTES_KEY, useNotes } from "@/hooks/use-notes";
import { ApiError, createNote, deleteNote, updateNote, type ApiNote, type NoteCreate, type NoteUpdate } from "@/lib/api";

type Note = { id: string; title?: string | undefined; content: string; createdAt: number };

const PAGE_SIZE = 10;

const formatDate = (timestamp: number) =>
  new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

const fromApi = (n: ApiNote): Note => ({ id: String(n.id), title: n.title ?? undefined, content: n.content, createdAt: new Date(n.created_at).getTime() });

export function NotesScreen() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState("");
  useEffect(() => { const t = setTimeout(() => setKeyword(query.trim()), 300); return () => clearTimeout(t); }, [query]);
  const notesQuery = useNotes(keyword);
  const loading = notesQuery.isPending;
  const refetch = () => queryClient.invalidateQueries({ queryKey: NOTES_KEY });

  const visible = useMemo(() => (notesQuery.data ?? []).map(fromApi).sort((a, b) => b.createdAt - a.createdAt), [notesQuery.data]);
  const searching = Boolean(keyword);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const runOnCard = async (id: string, fn: () => Promise<unknown>) => {
    setBusy((s) => new Set([...s, id]));
    setActionError("");
    try { await fn(); await refetch(); }
    catch (e) { setActionError(e instanceof Error ? e.message : "Request failed. Please try again."); }
    finally { setBusy((s) => { const next = new Set(s); next.delete(id); return next; }); }
  };

  const add = async (body: NoteCreate) => { await createNote(body); setPage(1); await refetch(); };

  return (
    <div className="space-y-5">
      <AddNoteForm onAdd={add} />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search notes"
          placeholder="Search notes by title or content…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          className="h-10 bg-background pl-9"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {visible.length} {searching ? "found" : "saved"}
        </p>
      </div>

      {actionError && <ErrorNotice title={actionError} onRetry={() => { setActionError(""); void refetch(); }} />}

      {loading ? (
        <ListSkeleton label="Loading notes" />
      ) : notesQuery.isError ? (
        <ErrorNotice variant={notesQuery.error instanceof ApiError && notesQuery.error.status === 0 ? "offline" : "error"} title="Couldn't load your notes." body={notesQuery.error.message} onRetry={() => void notesQuery.refetch()} />
      ) : visible.length === 0 && !searching ? (
        <EmptyBlock
          icon={<NotebookPen className="size-7 text-primary" strokeWidth={1.5} />}
          title="No notes yet"
          body="Capture your first note above — a thought, a list, anything worth keeping."
        />
      ) : visible.length === 0 ? (
        <EmptyBlock
          icon={<SearchX className="size-7 text-primary" strokeWidth={1.5} />}
          title="Nothing matches"
          body={`No notes contain “${keyword}”. Try a different word or start over.`}
          action={<Button variant="outline" size="sm" onClick={() => { setQuery(""); setKeyword(""); setPage(1); }}>Clear search</Button>}
        />
      ) : (
        <ul className="space-y-3">
          {pageItems.map((note) => (
            <NoteCard key={note.id} note={note} busy={busy.has(note.id)} onUpdate={(p) => runOnCard(note.id, () => updateNote(note.id, p))} onDelete={() => runOnCard(note.id, () => deleteNote(note.id))} />
          ))}
        </ul>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="icon" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft /></Button>
          <span className="font-mono text-xs text-muted-foreground">Page {currentPage} / {pageCount}</span>
          <Button variant="outline" size="icon" aria-label="Next page" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}><ChevronRight /></Button>
        </div>
      )}
    </div>
  );
}

function AddNoteForm({ onAdd }: { onAdd: (body: NoteCreate) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const c = content.trim();
    if (!c) { setError("Write something before saving the note."); return; }
    const t = title.trim().slice(0, 200);
    const body: NoteCreate = { content: c.slice(0, 5000) };
    if (t) body.title = t;
    setSaving(true);
    try {
      await onAdd(body);
      setTitle(""); setContent(""); setError(""); setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the note. Please try again.");
    } finally { setSaving(false); }
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-medium transition-colors hover:text-primary">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground"><Plus className={cn("size-4 transition-transform duration-300", open && "rotate-45")} /></span>
        Add a new note
        <ChevronDown className={cn("ml-auto size-4 text-muted-foreground transition-transform duration-300", open && "rotate-180")} />
      </button>
      <div className={cn("grid transition-all duration-300 ease-out", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
        <div className="overflow-hidden">
          <form noValidate onSubmit={submit} className="space-y-4 border-t border-border p-4">
            <div className="space-y-2">
              <Label htmlFor="note-title">Title <span className="text-muted-foreground">(optional)</span></Label>
              <Input id="note-title" value={title} maxLength={200} disabled={!open} onChange={(e) => setTitle(e.target.value)} placeholder="Give it a name, or leave it blank" className="h-10 bg-background" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note-content">Content</Label>
              <textarea
                id="note-content"
                rows={5}
                maxLength={5000}
                disabled={!open}
                value={content}
                onChange={(e) => { setContent(e.target.value); if (error) setError(""); }}
                placeholder="Start writing…"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "note-content-error" : undefined}
                className={cn("w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30", error && "border-destructive")}
              />
              <FieldError id="note-content-error" message={error} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => { setOpen(false); setError(""); }}>Cancel</Button>
              <Button type="submit" disabled={saving} className="active:scale-[0.98]">{saving ? <Loader2 className="animate-spin" /> : <Plus />} Save note</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function NoteCard({ note, busy, onUpdate, onDelete }: { note: Note; busy: boolean; onUpdate: (p: NoteUpdate) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(note.title ?? "");
  const [draftContent, setDraftContent] = useState(note.content);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  const startEdit = () => {
    setDraftTitle(note.title ?? "");
    setDraftContent(note.content);
    setError("");
    setEditing(true);
  };

  const save = () => {
    const c = draftContent.trim();
    if (!c) { setError("The note can't be empty."); return; }
    const patch: NoteUpdate = {};
    const t = draftTitle.trim().slice(0, 200);
    if (t !== (note.title ?? "")) patch.title = t;
    if (c.slice(0, 5000) !== note.content) patch.content = c.slice(0, 5000);
    setEditing(false);
    if (Object.keys(patch).length) onUpdate(patch);
  };

  return (
    <li className={cn("animate-task-in group relative rounded-lg border border-border bg-card p-4 shadow-sm transition-all duration-300 hover:shadow-md", busy && "pointer-events-none opacity-60")} aria-busy={busy}>
      {editing ? (
        <div className="animate-form-swap space-y-3">
          <Input aria-label="Note title" autoFocus value={draftTitle} maxLength={200} placeholder="Title (optional)" onChange={(e) => setDraftTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") setEditing(false); }} className="h-9 bg-background" />
          <div className="space-y-2">
            <textarea
              aria-label="Note content"
              rows={5}
              maxLength={5000}
              value={draftContent}
              onChange={(e) => { setDraftContent(e.target.value); if (error) setError(""); }}
              onKeyDown={(e) => { if (e.key === "Escape") setEditing(false); }}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "note-edit-error" : undefined}
              className={cn("w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30", error && "border-destructive")}
            />
            <FieldError id="note-edit-error" message={error} />
          </div>
          <div className="flex gap-1">
            <Button size="sm" onClick={save}><Check /> Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <>
          {note.title && <h3 className="font-display text-lg font-semibold leading-snug">{note.title}</h3>}
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-foreground/90">{note.content}</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              {busy ? <Loader2 className="size-3 animate-spin" /> : <CalendarDays className="size-3" />} {formatDate(note.createdAt)}
            </span>
            <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:transition-opacity sm:duration-200 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
              {confirming ? (
                <div className="animate-form-swap flex gap-1">
                  <Button size="sm" variant="destructive" disabled={busy} onClick={() => { setConfirming(false); onDelete(); }}>Confirm</Button>
                  <Button size="sm" variant="ghost" aria-label="Cancel delete" onClick={() => setConfirming(false)}><X /></Button>
                </div>
              ) : (
                <>
                  <Button size="icon" variant="ghost" aria-label="Edit note" className="size-10 sm:size-8" onClick={startEdit}><Pencil /></Button>
                  <Button size="icon" variant="ghost" aria-label="Delete note" className="size-10 hover:text-destructive sm:size-8" onClick={() => setConfirming(true)}><Trash2 /></Button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </li>
  );
}

function EmptyBlock({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="animate-mode-enter rounded-lg border border-dashed border-border py-14 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-surface-raised">{icon}</div>
      <h3 className="mt-4 font-display text-xl font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
