const REF_KEY = "inkpreview.ref";

/** On boot: persist a `?ref=` code from the URL so it survives until sign-in. */
export function captureRef(): void {
  try {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) localStorage.setItem(REF_KEY, ref);
  } catch {
    /* ignore storage errors (private mode) */
  }
}

export function getRef(): string | null {
  try {
    return localStorage.getItem(REF_KEY);
  } catch {
    return null;
  }
}

/** The user's invite link — a friend who signs in via it grants the user +1. */
export function referralLink(userId: string): string {
  return `${window.location.origin}/?ref=${encodeURIComponent(userId)}`;
}
