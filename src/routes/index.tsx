import { createFileRoute } from "@tanstack/react-router";
import { Bot, CheckSquare2, ChevronRight, LogOut, Menu, MessageCircle, Moon, Sparkles, Sun, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Personal AI Assistant — Your calm command center" },
      { name: "description", content: "A focused personal workspace for AI conversations, tasks, and notes." },
      { property: "og:title", content: "Personal AI Assistant" },
      { property: "og:description", content: "A focused personal workspace for AI conversations, tasks, and notes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Mode = "chat" | "organize";

function Index() {
  const [mode, setMode] = useState<Mode>("chat");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("personal-ai-theme");
    const nextDark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(nextDark);
    document.documentElement.classList.toggle("dark", nextDark);
  }, []);

  const toggleTheme = () => {
    const nextDark = !dark;
    setDark(nextDark);
    document.documentElement.classList.toggle("dark", nextDark);
    window.localStorage.setItem("personal-ai-theme", nextDark ? "dark" : "light");
  };

  const chooseMode = (nextMode: Mode) => {
    setMode(nextMode);
    setMobileOpen(false);
  };

  return (
    <TooltipProvider delayDuration={350}>
      <div className="min-h-screen bg-background text-foreground">
        <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-border/80 bg-background/90 px-4 backdrop-blur-xl lg:hidden">
          <Brand compact />
          <Button variant="ghost" size="icon" aria-label={mobileOpen ? "Close navigation" : "Open navigation"} onClick={() => setMobileOpen((open) => !open)}>
            {mobileOpen ? <X /> : <Menu />}
          </Button>
        </header>

        {mobileOpen && <button aria-label="Close navigation" className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />}

        <aside className={cn("fixed inset-y-0 left-0 z-50 flex w-[min(19rem,86vw)] flex-col border-r border-border bg-card p-5 transition-transform duration-300 ease-out lg:w-72 lg:translate-x-0", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
          <Brand />
          <div className="mt-10 px-2 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Workspace</div>
          <nav className="mt-3 space-y-1.5" aria-label="Workspace navigation">
            <NavItem active={mode === "chat"} icon={<MessageCircle />} label="Chat" detail="Ask, explore, think" onClick={() => chooseMode("chat")} />
            <NavItem active={mode === "organize"} icon={<CheckSquare2 />} label="Tasks & Notes" detail="Plan and remember" onClick={() => chooseMode("organize")} />
          </nav>

          <div className="mt-auto border-t border-border pt-5">
            <div className="mb-5 flex items-center justify-between rounded-md bg-muted px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <span className="relative flex size-8 items-center justify-center rounded-md bg-background text-primary shadow-sm">
                  {dark ? <Moon className="size-4" /> : <Sun className="size-4" />}
                </span>
                <div>
                  <p className="text-sm font-medium">Appearance</p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{dark ? "Dark" : "Light"} mode</p>
                </div>
              </div>
              <button type="button" role="switch" aria-checked={Boolean(dark)} aria-label="Toggle dark mode" onClick={toggleTheme} className="relative h-7 w-12 rounded-full bg-border transition-colors duration-300 aria-checked:bg-primary">
                <span className="absolute left-1 top-1 size-5 rounded-full bg-card shadow-sm transition-transform duration-300 aria-checked:translate-x-5" />
              </button>
            </div>
            <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive">
              <LogOut /> Log out
            </Button>
          </div>
        </aside>

        <main className="min-h-screen pt-16 lg:pl-72 lg:pt-0">
          <div className="flex min-h-screen flex-col px-5 py-8 sm:px-8 lg:px-12 lg:py-10 xl:px-16">
            <div className="animate-shell-enter flex items-center justify-between border-b border-border pb-6">
              <div>
                <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary">{mode === "chat" ? "Conversation space" : "Personal workspace"}</p>
                <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">{mode === "chat" ? "Chat" : "Tasks & Notes"}</h1>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" className="hidden sm:inline-flex" aria-label="Assistant status">
                    <Sparkles className="text-primary" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Assistant ready</TooltipContent>
              </Tooltip>
            </div>

            <section key={mode} className="animate-mode-enter flex flex-1 items-center justify-center py-12">
              <EmptyState mode={mode} />
            </section>

            <footer className="flex items-center justify-between border-t border-border pt-5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <span className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-success" /> System ready</span>
              <span>Local workspace</span>
            </footer>
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
        <Bot className="size-5" />
        <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-card bg-success" />
      </div>
      <div className={cn(compact && "leading-tight")}>
        <p className="font-display text-lg font-semibold">Personal AI</p>
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Assistant</p>
      </div>
    </div>
  );
}

function NavItem({ active, icon, label, detail, onClick }: { active: boolean; icon: React.ReactNode; label: string; detail: string; onClick: () => void }) {
  return (
    <Button variant="ghost" onClick={onClick} className={cn("group h-auto w-full justify-start gap-3 px-3 py-3 text-left", active && "bg-accent text-accent-foreground hover:bg-accent")}>
      <span className={cn("flex size-9 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors group-hover:text-primary [&_svg]:size-4", active && "border-primary/20 bg-primary text-primary-foreground")}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block truncate font-mono text-[10px] font-normal text-muted-foreground">{detail}</span>
      </span>
      <ChevronRight className={cn("size-4 text-muted-foreground transition-transform", active && "translate-x-0.5 text-primary")} />
    </Button>
  );
}

function EmptyState({ mode }: { mode: Mode }) {
  const chat = mode === "chat";
  return (
    <div className="mx-auto max-w-lg text-center">
      <div className="mx-auto flex size-20 items-center justify-center rounded-full border border-border bg-surface-raised shadow-sm">
        {chat ? <MessageCircle className="size-8 text-primary" strokeWidth={1.5} /> : <CheckSquare2 className="size-8 text-primary" strokeWidth={1.5} />}
      </div>
      <p className="mt-7 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary">Coming next</p>
      <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">{chat ? "A clear space to think" : "Everything in its place"}</h2>
      <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-muted-foreground sm:text-base">
        {chat ? "Your assistant conversations will begin here. For now, this workspace is ready and waiting." : "Your tasks and notes will live here. The foundation is set for focused planning."}
      </p>
      <div className="mt-8 inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground shadow-sm">
        <span className="size-1.5 rounded-full bg-warning" /> Empty by design
      </div>
    </div>
  );
}
