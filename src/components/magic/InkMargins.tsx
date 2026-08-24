import { motion, useReducedMotion } from "motion/react";

// Real AI-generated minimal tattoos (transparent, gpt-image-1), shown inverted
// to faint white ink in the margins — like flash sketches on a dark studio wall.
const INK = [
  "/ink/moon.png",
  "/ink/snake.png",
  "/ink/rose.png",
  "/ink/moth.png",
  "/ink/dagger.png",
  "/ink/eye.png",
  "/ink/mountains.png",
  "/ink/swallow.png",
];

type Speck = {
  side: "left" | "right";
  top: string;
  off: string;
  size: number;
  rot: number;
  op: number;
  src: string;
  delay: number;
};

const SCATTER: Speck[] = [
  { side: "left", top: "9%", off: "3%", size: 86, rot: -10, op: 0.26, src: INK[0], delay: 0 },
  { side: "left", top: "35%", off: "6%", size: 66, rot: 8, op: 0.2, src: INK[2], delay: 0.6 },
  { side: "left", top: "60%", off: "2%", size: 100, rot: -6, op: 0.24, src: INK[6], delay: 1.1 },
  { side: "left", top: "83%", off: "6%", size: 72, rot: 12, op: 0.2, src: INK[4], delay: 1.6 },
  { side: "right", top: "12%", off: "4%", size: 90, rot: 9, op: 0.26, src: INK[5], delay: 0.3 },
  { side: "right", top: "38%", off: "2%", size: 64, rot: -9, op: 0.2, src: INK[7], delay: 0.9 },
  { side: "right", top: "62%", off: "6%", size: 82, rot: 6, op: 0.24, src: INK[3], delay: 1.3 },
  { side: "right", top: "85%", off: "3%", size: 72, rot: -12, op: 0.2, src: INK[1], delay: 1.8 },
];

/** Decorative real-tattoo ink in the page margins (desktop only). */
export function InkMargins() {
  const reduce = useReducedMotion();
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 hidden overflow-hidden md:block"
    >
      {SCATTER.map((s, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{
            top: s.top,
            [s.side]: s.off,
            width: s.size,
            height: s.size,
            opacity: s.op,
            rotate: `${s.rot}deg`,
          }}
          animate={reduce ? undefined : { y: [0, -12, 0] }}
          transition={{ duration: 8 + s.delay * 2, repeat: Infinity, ease: "easeInOut", delay: s.delay }}
        >
          <img src={s.src} alt="" loading="lazy" className="h-full w-full object-contain invert" />
        </motion.div>
      ))}
    </div>
  );
}
