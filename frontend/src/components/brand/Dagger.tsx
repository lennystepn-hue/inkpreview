/** The InkPreview mark: a flash dagger (same geometry as the app icon). */
export function Dagger({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="140 56 232 400"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      fill="currentColor"
    >
      <circle cx="256" cy="86" r="24" />
      <path d="M238 108h36l-4 92h-28z" />
      <path d="M150 196q106-22 212 0q8 2 8 12v10q0 10-10 9q-104-18-208 0q-10 1-10-9v-10q0-10 8-12z" />
      <path d="M226 232h60l-26 214q-4 14-8 0z" />
    </svg>
  );
}
