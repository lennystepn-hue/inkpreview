import { useQuery } from "@tanstack/react-query";

import { fetchUsage } from "./api";

/** Live generation quota for the current user. Invalidate ["usage"] after a job. */
export function useUsage() {
  return useQuery({ queryKey: ["usage"], queryFn: fetchUsage, staleTime: 30_000 });
}
