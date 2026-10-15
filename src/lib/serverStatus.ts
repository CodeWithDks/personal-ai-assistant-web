import { useSyncExternalStore } from "react";

import { API_BASE_URL } from "./config";

export type ServerStatus = "checking" | "online" | "waking" | "offline";
type Snapshot = { status: ServerStatus; lastContact: number | null };

const HEALTH_TIMEOUT_MS = 60_000;
const SLOW_MS = 5_000;
const ONLINE_EVERY_MS = 60_000;
const RETRY_EVERY_MS = 15_000;

let snap: Snapshot = { status: "checking", lastContact: null };
const listeners = new Set<() => void>();

function set(status: ServerStatus, contacted = false) {
  const lastContact = contacted ? Date.now() : snap.lastContact;
  if (status === snap.status && lastContact === snap.lastContact) return;
  snap = { status, lastContact };
  listeners.forEach((fn) => fn());
  schedule();
}

export const getServerStatus = () => snap;
const subscribe = (fn: () => void) => (listeners.add(fn), () => void listeners.delete(fn));
export const useServerStatus = () => useSyncExternalStore(subscribe, getServerStatus, getServerStatus);

/* ---------- health check ---------- */
let inFlight: Promise<void> | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let started = false;

const visible = () => typeof document === "undefined" || document.visibilityState === "visible";

function schedule() {
  if (!started) return;
  clearTimeout(timer);
  if (!visible() || inFlight || snap.status === "checking") return;
  timer = setTimeout(() => void checkHealth(), snap.status === "online" ? ONLINE_EVERY_MS : RETRY_EVERY_MS);
}

/** GET /health with no custom headers (no CORS preflight). Only one in flight at a time. */
export function checkHealth(): Promise<void> {
  if (inFlight) return inFlight;
  clearTimeout(timer);
  const controller = new AbortController();
  const abort = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  const slow = setTimeout(() => { if (snap.status !== "online") set("waking"); }, SLOW_MS);
  inFlight = fetch(`${API_BASE_URL}/health`, { signal: controller.signal })
    .then((res) => {
      if (res.status === 200) set("online", true);
      else set("offline");
    })
    .catch(() => set("offline"))
    .finally(() => {
      clearTimeout(abort);
      clearTimeout(slow);
      inFlight = null;
      schedule();
    });
  return inFlight;
}

/** Starts the health loop and browser listeners. Returns a cleanup. */
export function startServerStatus() {
  if (started) return () => {};
  started = true;
  const onVisible = () => { if (visible()) void checkHealth(); else clearTimeout(timer); };
  const onOnline = () => void checkHealth();
  const onOffline = () => set("offline");
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  void checkHealth();
  return () => {
    started = false;
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
  };
}

/* ---------- learning from normal requests ---------- */
export function reportResponse(status: number) {
  if (status === 429) return;
  if (status === 502 || status === 503 || status === 504) {
    set("waking");
    void checkHealth();
    return;
  }
  set("online", true);
}

export function reportNetworkError() {
  set("waking");
  void checkHealth();
}
