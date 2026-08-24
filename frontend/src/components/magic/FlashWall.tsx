import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/cn";
import { useFeed } from "@/lib/useFeed";

type Glow = "acid" | "cyan" | "magenta";

const GLOW: Record<Glow, string> = {
  acid: "shadow-[var(--shadow-glow-acid)]",
  cyan: "shadow-[var(--shadow-glow-cyan)]",
  magenta: "shadow-[var(--shadow-glow-magenta)]",
};

const GLOWS: Glow[] = ["acid", "cyan", "magenta"];

// Bundled samples — shown until the live feed has enough real designs.
const BUNDLED = [
  "/flash/snake-dagger.png",
  "/flash/koi.png",
  "/flash/moth.png",
  "/flash/mandala.png",
  "/flash/heart.png",
  "/flash/celestial.png",
];

/** Newest real designs first (the feed), topped up with bundled samples. */
function useFlashSrcs(count: number): string[] {
  const { data } = useFeed();
  const live = (data ?? [])
    .map((d) => d.thumb_url ?? d.clean_png_url)
    .filter((s): s is string => Boolean(s));
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const s of [...live, ...BUNDLED]) {
    if (!seen.has(s)) {
      seen.add(s);
      merged.push(s);
    }
  }
  return merged.slice(0, count);
}

function FlashCard({
  src,
  tilt,
  glow,
  delay = 0,
  className,
}: {
  src: string;
  tilt: number;
  glow: Glow;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, rotate: tilt }}
      animate={
        reduce ? { opacity: 1, rotate: tilt } : { opacity: 1, scale: 1, rotate: tilt, y: [0, -8, 0] }
      }
      transition={{
        opacity: { duration: 0.5, delay },
        scale: { duration: 0.5, delay },
        y: { duration: 5 + delay * 2, repeat: Infinity, ease: "easeInOut", delay },
      }}
      className={cn(
        "overflow-hidden rounded-2xl border border-white/12 bg-white",
        GLOW[glow],
        className,
      )}
    >
      <img src={src} alt="AI tattoo flash" loading="lazy" className="h-full w-full object-cover" />
    </motion.div>
  );
}

/** Desktop editorial: a clean curated grid (live feed + bundled) with hover lift. */
export function FlashGallery({ className }: { className?: string }) {
  const srcs = useFlashSrcs(6);
  return (
    <div className={cn("grid grid-cols-2 gap-5 lg:grid-cols-3", className)}>
      {srcs.map((src, i) => (
        <motion.div
          key={src + i}
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-8%" }}
          transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
          className="group overflow-hidden rounded-2xl border border-white/10 bg-white shadow-xl transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[var(--shadow-glow-acid)]"
        >
          <img
            src={src}
            alt="AI tattoo flash"
            loading="lazy"
            className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </motion.div>
      ))}
    </div>
  );
}

/** Tiny acid sparks scattered around the hero fan. */
function Sparks() {
  const reduce = useReducedMotion();
  const SPOTS = [
    { left: "8%", top: "6%", size: "text-sm", color: "text-acid/80", delay: 0 },
    { left: "88%", top: "14%", size: "text-xs", color: "text-cyan/70", delay: 0.8 },
    { left: "16%", top: "78%", size: "text-xs", color: "text-magenta/70", delay: 1.4 },
    { left: "80%", top: "82%", size: "text-base", color: "text-acid/60", delay: 0.4 },
  ];
  return (
    <>
      {SPOTS.map((s, i) => (
        <motion.span
          key={i}
          aria-hidden
          className={cn("absolute select-none", s.size, s.color)}
          style={{ left: s.left, top: s.top }}
          animate={reduce ? undefined : { opacity: [0.25, 1, 0.25], scale: [0.9, 1.15, 0.9] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", delay: s.delay }}
        >
          ✦
        </motion.span>
      ))}
    </>
  );
}

/** Mobile hero: an oversized fanned hand of real flash — the wow moment. */
export function FlashStrip({ className }: { className?: string }) {
  const srcs = useFlashSrcs(5);
  const reduce = useReducedMotion();
  if (srcs.length < 3) return null;
  const five = srcs.length >= 5;
  return (
    <div className={cn("relative mx-auto flex h-48 w-full items-center justify-center", className)}>
      <Sparks />
      {/* far edges — peeking cards (only when we have 5) */}
      {five && (
        <>
          <motion.div
            initial={{ opacity: 0, x: -40, rotate: -18 }}
            animate={{ opacity: 1, x: 0, rotate: -18 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="absolute z-0 h-24 w-24 -translate-x-[8.25rem] overflow-hidden rounded-2xl border border-white/10 bg-white opacity-70"
          >
            <img src={srcs[3]} alt="" loading="lazy" className="h-full w-full object-cover" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 40, rotate: 18 }}
            animate={{ opacity: 1, x: 0, rotate: 18 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="absolute z-0 h-24 w-24 translate-x-[8.25rem] overflow-hidden rounded-2xl border border-white/10 bg-white opacity-70"
          >
            <img src={srcs[4]} alt="" loading="lazy" className="h-full w-full object-cover" />
          </motion.div>
        </>
      )}
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, x: -60, rotate: -24 }}
        animate={{ opacity: 1, x: 0, rotate: 0 }}
        transition={{ duration: 0.55, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="absolute z-10 -translate-x-[4.75rem]"
      >
        <FlashCard src={srcs[0]} glow={GLOWS[0]} tilt={-10} className="h-36 w-36" />
      </motion.div>
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, x: 60, rotate: 24 }}
        animate={{ opacity: 1, x: 0, rotate: 0 }}
        transition={{ duration: 0.55, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="absolute z-10 translate-x-[4.75rem]"
      >
        <FlashCard src={srcs[2]} glow={GLOWS[2]} tilt={10} className="h-36 w-36" />
      </motion.div>
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 36, scale: 0.85 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="absolute z-20"
      >
        <FlashCard src={srcs[1]} glow={GLOWS[1]} tilt={0} className="h-44 w-44" />
      </motion.div>
    </div>
  );
}
