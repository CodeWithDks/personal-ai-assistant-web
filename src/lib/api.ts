import { API_BASE_URL, CHAT_TIMEOUT_MS } from "./config";

const TOKEN_KEY = "personal-ai-token";
const TIMEOUT_MS = 60_000;
const SLOW_MS = 5_000;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/* ---------- token ---------- */
export const getToken = () => (typeof window === "undefined" ? null : window.localStorage.getItem(TOKEN_KEY));
export const setToken = (t: string) => window.localStorage.setItem(TOKEN_KEY, t);

type Listener = () => void;
const unauthListeners = new Set<Listener>();
const clearCacheListeners = new Set<Listener>();
export const onUnauthorized = (fn: Listener) => (unauthListeners.add(fn), () => void unauthListeners.delete(fn));
export const onClearCache = (fn: Listener) => (clearCacheListeners.add(fn), () => void clearCacheListeners.delete(fn));

/** Clears the token and any cached data. */
export function clearSession() {
  window.localStorage.removeItem(TOKEN_KEY);
  clearCacheListeners.forEach((fn) => fn());
}

/* ---------- waking-up state ---------- */
let slowCount = 0;
const slowListeners = new Set<(waking: boolean) => void>();
const emitSlow = () => slowListeners.forEach((fn) => fn(slowCount > 0));
export const onWakingChange = (fn: (waking: boolean) => void) => (slowListeners.add(fn), () => void slowListeners.delete(fn));

/* ---------- error messages ---------- */
type Detail = string | { loc?: (string | number)[]; msg?: string }[] | undefined;

export function formatDetail(detail: Detail): string | null {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const parts = detail.map((d) => {
      const field = d.loc?.filter((l) => l !== "body").join(".");
      return field ? `${field}: ${d.msg ?? "invalid"}` : d.msg ?? "Invalid value";
    });
    return parts.length ? parts.join("; ") : null;
  }
  return null;
}

export function messageFor(status: number, path: string, detail: Detail): string {
  if (status === 401 && path.startsWith("/auth/login")) return "Incorrect email or password.";
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 429) return "Too many requests, please wait a minute.";
  if (status >= 500) return "Something went wrong on the server. Please try again.";
  if (status === 422) return formatDetail(detail) ?? "Some of the information is invalid.";
  return formatDetail(detail) ?? "Request failed. Please try again.";
}

const NETWORK_MSG = "Couldn't reach the server. Please try again.";
const TIMEOUT_MSG = "The assistant took too long, please try again.";
/** Status used for client-side timeouts, so callers can tell them apart from network failures (status 0). */
export const TIMEOUT_STATUS = -1;

/* ---------- request ---------- */
type RequestOpts = { method?: string; json?: unknown; form?: Record<string, string>; multipart?: FormData; silent?: boolean; noTimeout?: boolean; timeoutMs?: number };

export async function apiRequest<T = unknown>(path: string, opts: RequestOpts = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  let body: BodyInit | null = null;
  if (opts.multipart) {
    // No Content-Type: the browser adds multipart/form-data with its boundary.
    body = opts.multipart;
  } else if (opts.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.json);
  } else if (opts.form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(opts.form).toString();
  }
  if (!path.startsWith("/auth/")) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeout = opts.noTimeout ? undefined : setTimeout(() => { timedOut = true; controller.abort(); }, opts.timeoutMs ?? TIMEOUT_MS);
  let slow = false;
  const slowTimer = opts.silent
    ? undefined
    : setTimeout(() => {
        slow = true;
        slowCount++;
        emitSlow();
      }, SLOW_MS);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { method: opts.method ?? "GET", headers, body, signal: controller.signal });
  } catch {
    throw new ApiError(timedOut ? TIMEOUT_MSG : NETWORK_MSG, timedOut ? TIMEOUT_STATUS : 0);
  } finally {
    clearTimeout(timeout);
    clearTimeout(slowTimer);
    if (slow) {
      slowCount--;
      emitSlow();
    }
  }

  const data = await res.json().catch(() => undefined);
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith("/auth/login")) {
      clearSession();
      unauthListeners.forEach((fn) => fn());
    }
    throw new ApiError(messageFor(res.status, path, (data as { detail?: Detail } | undefined)?.detail), res.status);
  }
  return data as T;
}

/* ---------- endpoints ---------- */
export const pingHealth = () => apiRequest("/health", { silent: true }).catch(() => undefined);

export const register = (email: string, password: string) =>
  apiRequest<{ id: number | string; email: string; created_at: string }>("/auth/register", { method: "POST", json: { email, password } });

export const login = (email: string, password: string) =>
  apiRequest<{ access_token: string; token_type: string }>("/auth/login", { method: "POST", form: { username: email, password } });

/* ---------- tasks ---------- */
export type ApiTask = {
  id: number | string;
  title: string;
  description: string | null;
  status: "pending" | "completed";
  priority: "low" | "medium" | "high";
  due_date: string | null;
  created_at: string;
};
export type TaskSearch = { keyword?: string; status?: string; priority?: string };
export type TaskCreate = { title: string; description?: string; priority: ApiTask["priority"]; due_date?: string };
export type TaskUpdate = Partial<Pick<ApiTask, "title" | "description" | "status" | "priority" | "due_date">>;

export function listTasks(search: TaskSearch = {}) {
  const params = new URLSearchParams();
  Object.entries(search).forEach(([k, v]) => { if (v) params.set(k, v); });
  const qs = params.toString();
  return qs
    ? apiRequest<ApiTask[]>(`/tasks/search?${qs}`)
    : apiRequest<ApiTask[]>("/tasks/?limit=100&offset=0");
}
export const createTask = (body: TaskCreate) => apiRequest<ApiTask>("/tasks/", { method: "POST", json: body });
export const updateTask = (id: ApiTask["id"], body: TaskUpdate) => apiRequest<ApiTask>(`/tasks/${id}`, { method: "PUT", json: body });
export const deleteTask = (id: ApiTask["id"]) => apiRequest<void>(`/tasks/${id}`, { method: "DELETE" });

/* ---------- notes ---------- */
export type ApiNote = { id: number | string; title: string | null; content: string; created_at: string };
export type NoteCreate = { title?: string; content: string };
export type NoteUpdate = { title?: string; content?: string };

export const listNotes = (keyword = "") =>
  keyword
    ? apiRequest<ApiNote[]>(`/notes/search?${new URLSearchParams({ keyword }).toString()}`)
    : apiRequest<ApiNote[]>("/notes/?limit=100&offset=0");
export const createNote = (body: NoteCreate) => apiRequest<ApiNote>("/notes/", { method: "POST", json: body });
export const updateNote = (id: ApiNote["id"], body: NoteUpdate) => apiRequest<ApiNote>(`/notes/${id}`, { method: "PUT", json: body });
export const deleteNote = (id: ApiNote["id"]) => apiRequest<void>(`/notes/${id}`, { method: "DELETE" });

/* ---------- chat ---------- */
/** Sends only the new message; the server keeps the conversation memory. Replies can take 30s+, so chat gets the longer CHAT_TIMEOUT_MS instead of the default 60s. */
export const sendChat = (message: string) =>
  apiRequest<{ reply: string }>("/chat/", { method: "POST", json: { message }, timeoutMs: CHAT_TIMEOUT_MS });

export type VoiceReply = { transcript: string; reply: string; audio_base64: string };
/** Uploads one recorded clip as multipart field "audio". */
export function sendVoice(file: Blob, filename: string) {
  const fd = new FormData();
  fd.append("audio", file, filename);
  return apiRequest<VoiceReply>("/chat/voice", { method: "POST", multipart: fd, timeoutMs: CHAT_TIMEOUT_MS });
}
