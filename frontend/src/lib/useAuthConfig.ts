import { useQuery } from "@tanstack/react-query";

import { fetchAuthConfig } from "./api";

/** True once the server confirms Google sign-in is configured. False while
 *  loading or when it isn't, so no dead "Sign in" button ever flashes up. */
export function useGoogleLogin(): boolean {
  const { data } = useQuery({
    queryKey: ["auth-config"],
    queryFn: fetchAuthConfig,
    staleTime: Infinity,
    retry: false,
  });
  return data?.google === true;
}
