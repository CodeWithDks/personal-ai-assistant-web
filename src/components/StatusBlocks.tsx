import { AlertTriangle, CircleAlert, RotateCw, WifiOff } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Brief mock delay on mount so loading states can be previewed; swap for real query status later. */
export function useMockLoading(ms = 700) {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return loading;
}

function Bone({ className }: { className?: string }) {
  return <span className={cn("block animate-pulse rounded-md bg-muted", className)} />;
}

/** Card-list skeleton shared by tasks and notes. */
export function ListSkeleton({ rows = 4, label }: { rows?: number; label: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-4 shadow-sm" style={{ opacity: 1 - i * 0.18 }}>
          <Bone className="h-4 w-2/5" />
          <Bone className="mt-3 h-3 w-4/5" />
          <Bone className="mt-2 h-3 w-3/5" />
          <div className="mt-4 flex gap-2"><Bone className="h-4 w-16" /><Bone className="h-4 w-20" /></div>
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** Chat history skeleton: alternating bubbles. */
export function ChatSkeleton() {
  return (
    <div role="status" aria-label="Loading conversation" className="mx-auto flex max-w-3xl flex-col gap-4 py-2">
      {["w-3/5", "w-2/5 self-end", "w-4/5", "w-1/3 self-end"].map((w, i) => (
        <Bone key={i} className={cn("h-14 rounded-lg", w)} />
      ))}
      <span className="sr-only">Loading conversation</span>
    </div>
  );
}

/** Inline form error — animated reveal, icon + text, tied to the field via id. */
export function FieldError({ id, message }: { id?: string; message?: string | undefined }) {
  const show = Boolean(message);
  return (
    <div className={cn("grid transition-all duration-200 ease-out", show ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
      <div className="overflow-hidden">
        {show && (
          <p id={id} role="alert" className="flex items-start gap-1.5 rounded-md border-l-2 border-destructive bg-destructive/10 px-2.5 py-1.5 text-xs font-medium text-destructive">
            <CircleAlert className="mt-px size-3.5 shrink-0" /> {message}
          </p>
        )}
      </div>
    </div>
  );
}

/** Block-level error, e.g. "couldn't reach the server". */
export function ErrorNotice({ title, body, onRetry, variant = "error", icon }: { title: string; body?: ReactNode; onRetry?: () => void; variant?: "error" | "offline"; icon?: ReactNode }) {
  return (
    <div role="alert" className="animate-mode-enter flex items-start gap-3 rounded-lg border border-destructive/30 border-l-4 border-l-destructive bg-destructive/5 p-4 shadow-sm">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
        {icon ?? (variant === "offline" ? <WifiOff className="size-4" /> : <AlertTriangle className="size-4" />)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-destructive">{variant === "offline" ? "Connection error" : "Something went wrong"}</p>
        <p className="mt-1 text-sm font-medium text-foreground">{title}</p>
        {body && <p className="mt-1 text-sm text-muted-foreground">{body}</p>}
      </div>
      {onRetry && <Button variant="outline" size="sm" onClick={onRetry}><RotateCw /> Retry</Button>}
    </div>
  );
}
