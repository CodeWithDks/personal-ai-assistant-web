export const API_BASE_URL: string =
  (import.meta.env["VITE_API_URL"] as string | undefined) ?? "https://personal-ai-assistant-euur.onrender.com";

/** Chat replies can take a while, but not forever: cancel after 2 minutes. */
export const CHAT_TIMEOUT_MS = 2000;
