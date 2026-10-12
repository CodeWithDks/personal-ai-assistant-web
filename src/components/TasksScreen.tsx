import { NotesScreen } from "@/components/NotesScreen";
import { AlertTriangle, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, Flag, ListChecks, Loader2, NotebookPen, Pencil, Plus, Search, SearchX, Trash2, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ErrorNotice, FieldError, ListSkeleton } from "@/components/StatusBlocks";
import { TASKS_KEY, useTasks } from "@/hooks/use-tasks";
import { ApiError, createTask, deleteTask, updateTask, type ApiTask, type TaskCreate, type TaskUpdate } from "@/lib/api";

type Priority = "low" | "medium" | "high";
type Status = "pending" | "completed";
type Task = { id: string; title: string; description?: string | undefined; priority: Priority; status: Status; dueDate?: string | undefined; createdAt: number };

const PAGE_SIZE = 10;
const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

const localISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayISO = () => localISO(new Date());
const formatDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** API task -> view task; due date reduced to the user's local calendar date. */
const fromApi = (t: ApiTask): Task => ({
  id: String(t.id),
  title: t.title,
  description: t.description ?? undefined,
  priority: t.priority,
  status: t.status === "completed" ? "completed" : "pending",
  dueDate: t.due_date ? localISO(new Date(t.due_date)) : undefined,
  createdAt: new Date(t.created_at).getTime(),
});

const priorityStyles: Record<Priority, string> = {
  high: "border-destructive/30 bg-destructive/10 text-destructive",
  medium: "border-warning/30 bg-warning/10 text-warning",
  low: "border-border bg-muted text-muted-foreground",
};
const priorityBar: Record<Priority, string> = { high: "bg-destructive", medium: "bg-warning", low: "bg-border" };

const selectClass = "h-10 rounded-md border border-input bg-background px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

export function OrganizeScreen() {
  const [tab, setTab] = useState<"tasks" | "notes">("tasks");
  return (
    <div className="w-full">
      <div className="relative inline-grid grid-cols-2 rounded-md bg-muted p-1" role="tablist">
        <span className={cn("absolute bottom-1 top-1 left-1 w-[calc(50%-4px)] rounded-sm bg-card shadow-sm transition-transform duration-300 ease-out", tab === "notes" && "translate-x-full")} />
        {(["tasks", "notes"] as const).map((item) => (
          <button key={item} role="tab" aria-selected={tab === item} onClick={() => setTab(item)} className={cn("relative z-10 flex h-9 items-center gap-2 px-5 text-sm font-medium capitalize transition-colors", tab === item ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {item === "tasks" ? <ListChecks className="size-4" /> : <NotebookPen className="size-4" />} {item}
          </button>
        ))}
      </div>
      <div key={tab} className="animate-mode-enter mt-6">
        {tab === "tasks" ? <TasksScreen /> : <NotesScreen />}
      </div>
    </div>
  );
}

function TasksScreen() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | Priority>("all");
  const [sort, setSort] = useState<"due" | "priority" | "newest">("due");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => { const t = setTimeout(() => setKeyword(query.trim()), 300); return () => clearTimeout(t); }, [query]);

  const tasksQuery = useTasks({ keyword, status: statusFilter === "all" ? "" : statusFilter, priority: priorityFilter === "all" ? "" : priorityFilter });
  const tasks = useMemo(() => (tasksQuery.data ?? []).map(fromApi), [tasksQuery.data]);
  const loading = tasksQuery.isPending;
  const filtering = Boolean(keyword) || statusFilter !== "all" || priorityFilter !== "all";

  const today = todayISO();
  const refetch = () => queryClient.invalidateQueries({ queryKey: TASKS_KEY });

  const visible = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (sort === "newest") return b.createdAt - a.createdAt;
      if (sort === "priority") return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.createdAt - a.createdAt;
      if (!a.dueDate && !b.dueDate) return b.createdAt - a.createdAt;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
  }, [tasks, sort]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const pendingCount = tasks.filter((t) => t.status === "pending").length;
  const completedCount = tasks.length - pendingCount;

  const runOnCard = async (id: string, fn: () => Promise<unknown>) => {
    setBusy((s) => new Set(s).add(id));
    setActionError("");
    try { await fn(); } catch (e) { setActionError(e instanceof Error ? e.message : "Request failed."); }
    finally {
      await refetch();
      setBusy((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  };
  const update = (id: string, patch: TaskUpdate) => { if (Object.keys(patch).length) void runOnCard(id, () => updateTask(id, patch)); };
  const remove = (id: string) => void runOnCard(id, () => deleteTask(id));
  const bulk = async (ids: string[], fn: (id: string) => Promise<unknown>) => {
    if (!ids.length) return;
    setBulkBusy(true); setActionError("");
    const results = await Promise.allSettled(ids.map(fn));
    const failed = results.filter((r) => r.status === "rejected").length;
    await refetch();
    setBulkBusy(false);
    if (failed) setActionError(`${failed} of ${ids.length} failed.`);
  };
  const addTask = async (body: TaskCreate) => {
    await createTask(body);
    await refetch();
    setPage(1);
  };
  const resetFilters = () => { setQuery(""); setKeyword(""); setStatusFilter("all"); setPriorityFilter("all"); setPage(1); };

  return (
    <div className="space-y-5">
      <AddTaskForm onAdd={addTask} />
      {actionError && <ErrorNotice title={actionError} onRetry={() => { setActionError(""); void refetch(); }} />}

      <div className="grid gap-3 rounded-lg border border-border bg-card p-3 sm:p-4 md:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search tasks" placeholder="Search tasks…" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} className="h-10 bg-background pl-9" />
        </div>
        <select aria-label="Filter by status" className={selectClass} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setPage(1); }}>
          <option value="all">All statuses</option><option value="pending">Pending</option><option value="completed">Completed</option>
        </select>
        <select aria-label="Filter by priority" className={selectClass} value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value as typeof priorityFilter); setPage(1); }}>
          <option value="all">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
        </select>
        <select aria-label="Sort tasks" className={selectClass} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="due">Sort: Due date</option><option value="priority">Sort: Priority</option><option value="newest">Sort: Newest</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {visible.length} shown · {pendingCount} pending · {completedCount} done
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={pendingCount === 0 || bulkBusy} onClick={() => void bulk(tasks.filter((t) => t.status === "pending").map((t) => t.id), (id) => updateTask(id, { status: "completed" }))}>
            <CircleCheck /> Mark all done <span className="font-mono text-xs text-muted-foreground">({pendingCount})</span>
          </Button>
          <Button variant="outline" size="sm" className="hover:text-destructive" disabled={completedCount === 0 || bulkBusy} onClick={() => void bulk(tasks.filter((t) => t.status === "completed").map((t) => t.id), deleteTask)}>
            <Trash2 /> Delete completed <span className="font-mono text-xs text-muted-foreground">({completedCount})</span>
          </Button>
        </div>
      </div>

      {loading ? (
        <ListSkeleton label="Loading tasks" />
      ) : tasksQuery.isError && !tasksQuery.data ? (
        <ErrorNotice variant={tasksQuery.error instanceof ApiError && tasksQuery.error.status === 0 ? "offline" : "error"} title="Couldn't load your tasks." body={tasksQuery.error.message} onRetry={() => void tasksQuery.refetch()} />
      ) : tasks.length === 0 && !filtering ? (
        <EmptyBlock icon={<ListChecks className="size-7 text-primary" strokeWidth={1.5} />} title="No tasks yet" body="Add your first task above to start planning your day." />
      ) : visible.length === 0 ? (
        <EmptyBlock icon={<SearchX className="size-7 text-primary" strokeWidth={1.5} />} title="Nothing matches" body="No tasks fit your current search or filters." action={<Button variant="outline" size="sm" onClick={resetFilters}>Clear filters</Button>} />
      ) : (
        <ul className="space-y-3">
          {pageItems.map((task) => (
            <TaskCard key={task.id} task={task} today={today} busy={busy.has(task.id) || bulkBusy} onUpdate={(p) => update(task.id, p)} onDelete={() => remove(task.id)} />
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

function AddTaskForm({ onAdd }: { onAdd: (task: TaskCreate) => Promise<void> }) {
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) { setError("Give your task a title."); return; }
    if (t.length > 200) { setError("Keep the title under 200 characters."); return; }
    const body: TaskCreate = { title: t, priority };
    const desc = description.trim().slice(0, 1000);
    if (desc) body.description = desc;
    if (dueDate) body.due_date = new Date(`${dueDate}T00:00:00`).toISOString();
    setSubmitting(true);
    try { await onAdd(body); } catch (err) { setError(err instanceof Error ? err.message : "Couldn't add the task."); return; } finally { setSubmitting(false); }
    setTitle(""); setDescription(""); setPriority("medium"); setDueDate(""); setError(""); setOpen(false);
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-medium transition-colors hover:text-primary">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground"><Plus className={cn("size-4 transition-transform duration-300", open && "rotate-45")} /></span>
        Add a new task
        <ChevronDown className={cn("ml-auto size-4 text-muted-foreground transition-transform duration-300", open && "rotate-180")} />
      </button>
      <div className={cn("grid transition-all duration-300 ease-out", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
        <div className="overflow-hidden">
          <form noValidate onSubmit={submit} className="space-y-4 border-t border-border p-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Title</Label>
              <Input id="task-title" value={title} maxLength={200} disabled={!open} aria-invalid={Boolean(error)} aria-describedby={error ? "task-title-error" : undefined} onChange={(e) => { setTitle(e.target.value); setError(""); }} placeholder="What needs doing?" className={cn("h-10 bg-background", error && "border-destructive")} />
              <FieldError id="task-title-error" message={error} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-desc">Description <span className="text-muted-foreground">(optional)</span></Label>
              <textarea id="task-desc" rows={2} maxLength={1000} disabled={!open} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add a little context…" className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="task-priority">Priority</Label>
                <select id="task-priority" disabled={!open} className={cn(selectClass, "w-full")} value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-due">Due date <span className="text-muted-foreground">(optional)</span></Label>
                <Input id="task-due" type="date" disabled={!open} value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-10 bg-background" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => { setOpen(false); setError(""); }}>Cancel</Button>
              <Button type="submit" disabled={submitting} className="active:scale-[0.98]">{submitting ? <Loader2 className="animate-spin" /> : <Plus />} Add task</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function TaskCard({ task, today, busy, onUpdate, onDelete }: { task: Task; today: string; busy: boolean; onUpdate: (p: TaskUpdate) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);
  const [draftPriority, setDraftPriority] = useState<Priority>(task.priority);
  const [confirming, setConfirming] = useState(false);
  const done = task.status === "completed";
  const overdue = !done && task.dueDate && task.dueDate < today;
  const dueToday = !done && task.dueDate === today;

  const save = () => {
    const t = draftTitle.trim();
    if (!t) return;
    const patch: TaskUpdate = {};
    if (t.slice(0, 200) !== task.title) patch.title = t.slice(0, 200);
    if (draftPriority !== task.priority) patch.priority = draftPriority;
    onUpdate(patch);
    setEditing(false);
  };

  return (
    <li className={cn("animate-task-in group relative overflow-hidden rounded-lg border bg-card pl-4 pr-3 py-3.5 shadow-sm transition-all duration-300 hover:shadow-md", overdue ? "border-destructive/40" : "border-border", done && "opacity-75", busy && "pointer-events-none opacity-60")} aria-busy={busy}>
      <span className={cn("absolute inset-y-0 left-0 w-1", priorityBar[task.priority])} />
      <div className="flex items-start gap-3">
        <button type="button" disabled={busy} aria-label={done ? "Mark as pending" : "Mark as done"} onClick={() => onUpdate({ status: done ? "pending" : "completed" })} className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 active:scale-90", done ? "border-success bg-success text-primary-foreground" : "border-border hover:border-primary")}>
          {busy ? <Loader2 className="size-3 animate-spin" /> : done && <Check className="size-3" strokeWidth={3} />}
        </button>

        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="animate-form-swap flex flex-col gap-2 sm:flex-row">
              <Input aria-label="Task title" autoFocus value={draftTitle} maxLength={200} onChange={(e) => setDraftTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }} className="h-9 bg-background" />
              <select aria-label="Task priority" className={cn(selectClass, "h-9")} value={draftPriority} onChange={(e) => setDraftPriority(e.target.value as Priority)}>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
              </select>
              <div className="flex gap-1">
                <Button size="sm" onClick={save} disabled={!draftTitle.trim()}><Check /> Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <>
              <p className={cn("text-sm font-medium transition-colors", done && "text-muted-foreground line-through")}>{task.title}</p>
              {task.description && <p className="mt-1 text-xs leading-5 text-muted-foreground">{task.description}</p>}
            </>
          )}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em]">
            <span className={cn("inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5", priorityStyles[task.priority])}>
              <Flag className="size-3" /> {task.priority}
            </span>
            {done && <span className="rounded-sm border border-success/30 bg-success/10 px-1.5 py-0.5 text-success">completed</span>}
            {overdue && <span className="inline-flex items-center gap-1 rounded-sm border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-destructive"><AlertTriangle className="size-3" /> overdue</span>}
            {dueToday && <span className="rounded-sm border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-warning">due today</span>}
            {task.dueDate && <span className="inline-flex items-center gap-1 px-1 text-muted-foreground"><CalendarDays className="size-3" /> {formatDate(task.dueDate)}</span>}
          </div>
        </div>

        {!editing && (
          <div className="flex shrink-0 items-center gap-0.5">
            {confirming ? (
              <div className="animate-form-swap flex gap-1">
                <Button size="sm" variant="destructive" disabled={busy} onClick={() => { setConfirming(false); onDelete(); }}>Confirm</Button>
                <Button size="sm" variant="ghost" aria-label="Cancel delete" onClick={() => setConfirming(false)}><X /></Button>
              </div>
            ) : (
              <>
                {!done && <Button size="icon" variant="ghost" disabled={busy} aria-label="Quick mark done" className="size-10 hover:text-success sm:size-8" onClick={() => onUpdate({ status: "completed" })}><CircleCheck /></Button>}
                <Button size="icon" variant="ghost" disabled={busy} aria-label="Edit task" className="size-10 sm:size-8" onClick={() => { setDraftTitle(task.title); setDraftPriority(task.priority); setEditing(true); }}><Pencil /></Button>
                <Button size="icon" variant="ghost" disabled={busy} aria-label="Delete task" className="size-10 hover:text-destructive sm:size-8" onClick={() => setConfirming(true)}><Trash2 /></Button>
              </>
            )}
          </div>
        )}
      </div>
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
