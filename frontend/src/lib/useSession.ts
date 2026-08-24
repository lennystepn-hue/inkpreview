import { useQuery } from "@tanstack/react-query";

import { type Session, ensureSession } from "./api";

/** Bootstraps (and caches) the anonymous session for the whole app. */
export function useSession() {
  return useQuery<Session>({
    queryKey: ["session"],
    queryFn: ensureSession,
    staleTime: Infinity,
    retry: 1,
  });
}
