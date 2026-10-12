import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { listNotes, onClearCache } from "@/lib/api";

export const NOTES_KEY = ["notes"] as const;

/** Loads notes; uses the search endpoint only when keyword is non-empty. All note queries share the ["notes"] prefix. */
export function useNotes(keyword: string) {
  const queryClient = useQueryClient();
  useEffect(() => onClearCache(() => queryClient.removeQueries({ queryKey: NOTES_KEY })), [queryClient]);
  const k = keyword.trim();
  return useQuery({ queryKey: k ? [...NOTES_KEY, { keyword: k }] : NOTES_KEY, queryFn: () => listNotes(k), placeholderData: (prev) => prev });
}
