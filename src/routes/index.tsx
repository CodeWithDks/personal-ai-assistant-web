import { createFileRoute } from "@tanstack/react-router";
import { Bot, CheckCircle2, CheckSquare2, ChevronRight, LoaderCircle, LogOut, Menu, MessageCircle, Moon, Sparkles, Sun, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
type AuthMode = "login" | "register";
type AuthErrors = Partial<Record<"email" | "password" | "confirmPassword", string>>;

function Index() {
  const [mode, setMode] = useState<Mode>("chat");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState<boolean | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

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

  if (!isLoggedIn) {
    return <AuthScreen onLogin={() => setIsLoggedIn(true)} />;
  }

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

        <aside className={cn("fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-76 flex-col border-r border-border bg-card p-5 transition-transform duration-300 ease-out lg:w-72 lg:max-w-none lg:translate-x-0", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
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
            <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive" onClick={() => setIsLoggedIn(false)}>
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

function AuthScreen({ onLogin }: { onLogin: () => void }) {
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<AuthErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);

  const selectMode = (nextMode: AuthMode) => {
    if (submitting || nextMode === authMode) return;
    setAuthMode(nextMode);
    setErrors({});
    setRegistered(false);
  };

  const validate = () => {
    const nextErrors: AuthErrors = {};
    if (!email.trim()) nextErrors.email = "Enter your email address.";
    else if (!/^\S+@\S+\.\S+$/.test(email)) nextErrors.email = "Enter a valid email address.";
    if (!password) nextErrors.password = "Enter your password.";
    else if (authMode === "register" && password.length < 8) nextErrors.password = "Use at least 8 characters.";
    if (authMode === "register" && !confirmPassword) nextErrors.confirmPassword = "Confirm your password.";
    else if (authMode === "register" && password !== confirmPassword) nextErrors.confirmPassword = "Passwords don't match.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    await new Promise((resolve) => window.setTimeout(resolve, 750));

    if (authMode === "login") {
      onLogin();
      return;
    }

    setSubmitting(false);
    setRegistered(true);
    await new Promise((resolve) => window.setTimeout(resolve, 900));
    setRegistered(false);
    setAuthMode("login");
    setPassword("");
    setConfirmPassword("");
  };

  const clearError = (field: keyof AuthErrors) => {
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10 text-foreground sm:px-6">
      <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
      <div className="animate-auth-enter w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Brand />
        </div>

        <section className="border border-border bg-card p-5 shadow-sm sm:p-8" aria-labelledby="auth-heading">
          <div className="text-center">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary">Your personal workspace</p>
            <h1 id="auth-heading" className="mt-3 font-display text-3xl font-semibold">
              {authMode === "login" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {authMode === "login" ? "Sign in to continue to your assistant." : "Set up your space in just a moment."}
            </p>
          </div>

          <div className="relative mt-7 grid grid-cols-2 rounded-md bg-muted p-1" aria-label="Authentication mode">
            <span className={cn("absolute bottom-1 top-1 w-[calc(50%-4px)] rounded-sm bg-card shadow-sm transition-transform duration-300 ease-out", authMode === "register" && "translate-x-full")} />
            {(["login", "register"] as const).map((item) => (
              <Button key={item} type="button" variant="ghost" className={cn("relative z-10 h-9 capitalize hover:bg-transparent", authMode === item ? "text-foreground" : "text-muted-foreground")} aria-pressed={authMode === item} onClick={() => selectMode(item)} disabled={submitting}>
                {item}
              </Button>
            ))}
          </div>

          {registered ? (
            <div className="animate-success-in flex min-h-72 flex-col items-center justify-center text-center" role="status">
              <span className="flex size-14 items-center justify-center rounded-full bg-accent text-primary">
                <CheckCircle2 className="size-7" />
              </span>
              <h2 className="mt-5 font-display text-2xl font-semibold">Account ready</h2>
              <p className="mt-2 text-sm text-muted-foreground">Taking you back to sign in…</p>
            </div>
          ) : (
            <form key={authMode} className="animate-form-swap mt-7 space-y-5" noValidate onSubmit={handleSubmit}>
              <AuthField id="email" label="Email" type="email" autoComplete="email" placeholder="you@example.com" value={email} error={errors.email} onChange={(value) => { setEmail(value); clearError("email"); }} />
              <AuthField id="password" label="Password" type="password" autoComplete={authMode === "login" ? "current-password" : "new-password"} placeholder="Enter your password" value={password} error={errors.password} onChange={(value) => { setPassword(value); clearError("password"); }} />

              <div className={cn("grid transition-all duration-300", authMode === "register" ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")} aria-hidden={authMode !== "register"}>
                <div className="overflow-hidden">
                  <AuthField id="confirm-password" label="Confirm password" type="password" autoComplete="new-password" placeholder="Enter your password again" value={confirmPassword} error={errors.confirmPassword} disabled={authMode !== "register"} onChange={(value) => { setConfirmPassword(value); clearError("confirmPassword"); }} />
                </div>
              </div>

              <Button type="submit" size="lg" className="mt-1 w-full transition-transform active:scale-[0.98]" disabled={submitting}>
                {submitting ? <><LoaderCircle className="animate-spin" /> {authMode === "login" ? "Signing in…" : "Creating account…"}</> : authMode === "login" ? "Sign in" : "Create account"}
              </Button>
            </form>
          )}
        </section>
        <p className="mt-6 text-center font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">Private by design · Ready when you are</p>
      </div>
    </main>
  );
}

function AuthField({ id, label, type, autoComplete, placeholder, value, error, disabled, onChange }: { id: string; label: string; type: string; autoComplete: string; placeholder: string; value: string; error?: string; disabled?: boolean; onChange: (value: string) => void }) {
  const errorId = `${id}-error`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} autoComplete={autoComplete} placeholder={placeholder} value={value} disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={(event) => onChange(event.target.value)} className={cn("h-11 bg-background transition-[border-color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-ring/30", error && "border-destructive focus-visible:ring-destructive/20")} />
      <div className={cn("grid transition-all duration-200", error ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
        <p id={errorId} className="overflow-hidden text-xs font-medium text-destructive" role="alert">{error}</p>
      </div>
    </div>
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
