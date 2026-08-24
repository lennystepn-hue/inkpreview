import { type PointerEvent as ReactPointerEvent, useRef } from "react";

export type Placement = { pos: { x: number; y: number }; scale: number; rotation: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Direct-manipulation placement: one pointer drags position, two pointers
 *  pinch-to-scale + twist-to-rotate. Mirrors the slider ranges (scale 0.08–0.9,
 *  rotation ±180°). The element should set `touch-action: none`. */
export function usePlacementGestures(get: () => Placement, set: (p: Partial<Placement>) => void) {
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const rect = useRef<DOMRect | null>(null);
  const start = useRef<{ dist: number; angle: number; scale: number; rotation: number } | null>(
    null,
  );

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    rect.current = e.currentTarget.getBoundingClientRect();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const cur = get();
      start.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        angle: Math.atan2(b.y - a.y, b.x - a.x),
        scale: cur.scale,
        rotation: cur.rotation,
      };
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = rect.current;
    if (!r) return;

    if (pointers.current.size >= 2 && start.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const scale = clamp(start.current.scale * (dist / start.current.dist), 0.08, 0.9);
      const rot = clamp(
        Math.round(start.current.rotation + ((angle - start.current.angle) * 180) / Math.PI),
        -180,
        180,
      );
      set({ scale, rotation: rot });
    } else if (pointers.current.size === 1) {
      set({
        pos: {
          x: clamp((e.clientX - r.left) / r.width, 0, 1),
          y: clamp((e.clientY - r.top) / r.height, 0, 1),
        },
      });
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) start.current = null;
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    style: { touchAction: "none" as const },
  };
}
