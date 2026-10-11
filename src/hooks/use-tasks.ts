import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { listTasks, onClearCache, type TaskSearch } from "@/lib/api";

export const TASKS_KEY = ["tasks"] as const;

/** Loads tasks; uses the search endpoint only when a filter has a value. All task queries share the ["tasks"] prefix. */
export function useTasks(search: TaskSearch) {
  const queryClient = useQueryClient();
  useEffect(() => onClearCache(() => queryClient.removeQueries({ queryKey: TASKS_KEY })), [queryClient]);
  const clean: TaskSearch = {};
  if (search.keyword) clean.keyword = search.keyword;
  if (search.status) clean.status = search.status;
  if (search.priority) clean.priority = search.priority;
  return useQuery({ queryKey: [...TASKS_KEY, clean], queryFn: () => listTasks(clean), placeholderData: (prev) => prev });
}
