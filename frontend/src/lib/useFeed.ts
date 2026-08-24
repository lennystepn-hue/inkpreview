import { useQuery } from "@tanstack/react-query";

import { type FeedItem, fetchFeed } from "./api";

/** Public 'fresh ink' feed — newest finished designs across everyone. */
export function useFeed() {
  return useQuery<FeedItem[]>({
    queryKey: ["feed"],
    queryFn: () => fetchFeed(24),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
