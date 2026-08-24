/** Full-screen film-grain (paints via the .grain::after rule in theme.css). */
export function GrainOverlay() {
  return <div aria-hidden className="grain pointer-events-none fixed inset-0 z-[60]" />;
}
