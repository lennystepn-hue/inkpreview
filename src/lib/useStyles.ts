import { useQuery } from "@tanstack/react-query";

import { type Style, fetchStyles } from "./api";

export function useStyles() {
  return useQuery<Style[]>({
    queryKey: ["styles"],
    queryFn: fetchStyles,
    staleTime: Infinity,
  });
}
