import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type CSSProperties, useEffect, useState } from "react";

import { HOUSE_FLASH } from "@/components/magic/FlashWall";
import { NeonWord } from "@/components/ui/Neon";
import { cn } from "@/lib/cn";
import type { DictKey } from "@/lib/i18n";
import { useT } from "@/lib/useT";

/** House flash drawn stage by stage while a new design is generated:
 *  blue-pencil sketch → linework & blacks → finished shading/colour. The first
 *  two stages are derived from the finished art, so all three line up exactly. */
const FLASH = ["heart", "koi", "moth", "snake-dagger"].map(
  (id) => HOUSE_FLASH.find((f) => f.id === id)!,
);

export const RITUAL_ASSETS = FLASH.flatMap((f) => [
  `/loading/${f.id}-sketch.webp`,
  `/loading/${f.id}-lines.webp`,
  `/flash/${f.id}.webp`,
]);

/** Warm the first motif so the ritual never opens on blank paper. */
export function preloadRitual(all = false) {
  for (const src of all ? RITUAL_ASSETS : RITUAL_ASSETS.slice(0, 3)) {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
  }
}

// One motif: sketch 0–2.6 s, lines 2.8–5.6 s, shading 5.8–7.2 s, then a beat.
const CYCLE = 9000;
const T_LINES = 2800;
const T_SHADE = 5800;

type Mode = "draw" | "refine" | "place";

const STAGES: Record<"draw" | "place", { label: DictKey; step: DictKey }[]> = {
  draw: [
    { label: "ritual.stage.sketch", step: "ritual.gen.1" },
    { label: "ritual.stage.lines", step: "ritual.gen.2" },
    { label: "ritual.stage.shade", step: "ritual.gen.3" },
  ],
  place: [
    { label: "ritual.stage.stencil", step: "ritual.place.1" },
    { label: "ritual.stage.ink", step: "ritual.place.2" },
    { label: "ritual.stage.skin", step: "ritual.place.3" },
  ],
};

const TITLES: Record<Mode, DictKey> = {
  draw: "ritual.title.draw",
  refine: "ritual.title.refine",
  place: "ritual.title.place",
};

const TIPS: DictKey[] = [
  "ritual.tip.1",
  "ritual.tip.2",
  "ritual.tip.3",
  "ritual.tip.4",
  "ritual.tip.5",
  "ritual.tip.6",
];

export type RitualPhoto = {
  url: string;
  pos: { x: number; y: number };
  scale: number;
  rotation: number;
};

type Props = {
  mode?: Mode;
  /** place mode: the design being inked onto the photo. */
  motif?: string | null;
  /** place mode: the body photo and where the stencil sits on it. */
  photo?: RitualPhoto | null;
};

const anim = (name: string, ms: number, delay = 0, easing = "linear"): CSSProperties => ({
  animation: `${name} ${ms}ms ${easing} ${delay}ms both`,
});

/** The needle: a neon point riding the edge of the wipe, zig-zagging like a liner. */
function Needle({ delay, duration }: { delay: number; duration: number }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-x-[10%] h-0"
      style={{
        animation: [
          `needle-down ${duration}ms linear ${delay}ms both`,
          `fade-in 150ms ease ${delay}ms both`,
          `fade-out 250ms ease ${delay + duration - 150}ms forwards`,
        ].join(", "),
      }}
    >
      <span className="absolute inset-x-0 flex justify-center">
        <span
          className="h-2.5 w-2.5 rounded-full bg-neon-core shadow-[0_0_6px_2px_var(--color-neon),0_0_22px_6px_color-mix(in_srgb,var(--color-neon)_60%,transparent)]"
          style={{ animation: `needle-zigzag 460ms ease-in-out ${delay}ms infinite` }}
        />
      </span>
    </span>
  );
}

/** Draw mode: one flash sheet being drawn, stage by stage. */
function DrawingCard({ index, reduce }: { index: number; reduce: boolean }) {
  const f = FLASH[index % FLASH.length];
  const final = `/flash/${f.id}.webp`;
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { x: 70, rotate: 6, opacity: 0 }}
      animate={{ x: 0, rotate: -1.5, opacity: 1 }}
      exit={reduce ? { opacity: 0 } : { x: -90, rotate: -8, opacity: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="flash-card absolute inset-0"
    >
      <span aria-hidden className="tape tape-t" />
      <div className="relative aspect-square overflow-hidden">
        {reduce ? (
          <img
            src={final}
            alt=""
            className="flash-art absolute inset-0 h-full w-full object-contain p-[8%]"
          />
        ) : (
          <>
            <img
              src={`/loading/${f.id}-sketch.webp`}
              alt=""
              className="flash-art wipe absolute inset-0 h-full w-full object-contain p-[8%]"
              style={{
                animation: `wipe-down 2600ms cubic-bezier(.4,0,.2,1) 0ms both, fade-out 1300ms ease ${T_SHADE}ms forwards`,
              }}
            />
            <img
              src={`/loading/${f.id}-lines.webp`}
              alt=""
              className="flash-art wipe absolute inset-0 h-full w-full object-contain p-[8%]"
              style={anim("wipe-down", T_SHADE - T_LINES - 200, T_LINES)}
            />
            <img
              src={final}
              alt=""
              className="flash-art absolute inset-0 h-full w-full object-contain p-[8%]"
              style={anim("fade-in", 1400, T_SHADE, "ease")}
            />
            <Needle delay={T_LINES} duration={T_SHADE - T_LINES - 200} />
          </>
        )}
      </div>
      <span className="t-label flex items-center justify-between px-[7%] pb-3 text-[0.625rem] text-paper-mute">
        <span>{f.no}</span>
        <span>{f.caption}</span>
      </span>
    </motion.div>
  );
}

/** Place mode: the user's own photo — stencil first, then the needle inks it in. */
function InkingPhoto({
  photo,
  motif,
  reduce,
}: {
  photo: RitualPhoto;
  motif: string;
  reduce: boolean;
}) {
  const place: CSSProperties = {
    left: `${photo.pos.x * 100}%`,
    top: `${photo.pos.y * 100}%`,
    width: `${photo.scale * 100}%`,
    transform: `translate(-50%, -50%) rotate(${photo.rotation}deg)`,
  };
  const inkAt = T_LINES - 1200;
  return (
    <div className="rounded-[6px] bg-paper p-2 shadow-[var(--shadow-paper-lift)]">
      <div className="relative w-fit max-w-full overflow-hidden rounded-[3px]">
        <img src={photo.url} alt="" className="block max-h-[44dvh] w-auto max-w-full" />
        {/* stencil + ink multiply onto the skin as one group */}
        <div className="pointer-events-none absolute isolate mix-blend-multiply" style={place}>
          <img
            src={motif}
            alt=""
            className="stencil-ghost block w-full"
            style={
              reduce
                ? { opacity: 0.35 }
                : {
                    animation: `fade-in 900ms ease 0ms both, fade-out 1400ms ease ${T_SHADE}ms forwards`,
                  }
            }
          />
          <img
            src={motif}
            alt=""
            className={cn("absolute inset-0 block w-full opacity-90", !reduce && "wipe")}
            style={reduce ? undefined : anim("wipe-down", T_SHADE - inkAt - 200, inkAt)}
          />
        </div>
        {/* the needle glows on top, unblended */}
        {!reduce && (
          <div className="pointer-events-none absolute" style={place}>
            <img src={motif} alt="" className="invisible block w-full" />
            <Needle delay={inkAt} duration={T_SHADE - inkAt - 200} />
          </div>
        )}
        {!reduce && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent"
            style={{ animation: `shine 2600ms ease-in-out ${T_SHADE}ms infinite` }}
          />
        )}
      </div>
    </div>
  );
}

/** Full-screen wait state. Draw: house flash being drawn sketch → lines →
 *  shading. Place: the user's photo with the stencil being inked in. The status
 *  line, stage dots and a rotating studio tip keep the wait honest and short. */
export function ConjuringRitual({ mode = "draw", motif, photo }: Props) {
  const reduce = Boolean(useReducedMotion());
  const t = useT();
  const [start] = useState(() => performance.now());
  const [now, setNow] = useState(start);
  const kind = mode === "place" ? "place" : "draw";
  const stages = STAGES[kind];

  useEffect(() => {
    const id = window.setInterval(() => setNow(performance.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const elapsed = now - start;
  const cycle = Math.floor(elapsed / CYCLE);
  const at = kind === "place" ? elapsed : elapsed % CYCLE;
  const lines = kind === "place" ? T_LINES - 1200 : T_LINES;
  const stage = at < lines ? 0 : at < T_SHADE ? 1 : 2;
  const tip = TIPS[Math.floor(elapsed / 7000) % TIPS.length];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] overflow-y-auto bg-ground bg-[radial-gradient(900px_480px_at_50%_-120px,rgb(255_196_150/0.08),transparent_70%)]"
      role="dialog"
      aria-modal="true"
      aria-label={t(TITLES[mode])}
    >
      <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-7 px-6 py-10 text-center">
        <NeonWord className="text-[2.6rem] leading-none md:text-[3.25rem]">
          {t(TITLES[mode])}
        </NeonWord>

        {kind === "place" && photo && motif ? (
          <InkingPhoto photo={photo} motif={motif} reduce={reduce} />
        ) : (
          <div className="relative w-[min(70vw,19rem)] md:w-[22rem]">
            {/* holds the height of a card while the cards swap */}
            <div aria-hidden className="invisible">
              <div className="aspect-square" />
              <div className="pb-3 text-[0.625rem]">&nbsp;</div>
            </div>
            <AnimatePresence initial={false}>
              <DrawingCard key={cycle} index={cycle} reduce={reduce} />
            </AnimatePresence>
          </div>
        )}

        <div className="flex flex-col items-center gap-4">
          <p role="status" aria-live="polite" className="typewriter text-[1.0625rem] text-text">
            {t(stages[stage].step)}
            <span aria-hidden className="motion-safe:animate-[blink_1s_steps(1,end)_infinite]">
              _
            </span>
          </p>
          <ol className="flex items-center gap-2" aria-hidden>
            {stages.map((s, i) => (
              <li key={s.label} className="flex items-center gap-2">
                {i > 0 && <span className={cn("h-px w-6", i <= stage ? "bg-text-3" : "bg-line")} />}
                <span
                  className={cn(
                    "t-label flex items-center gap-1.5 transition-colors",
                    i === stage ? "text-text" : i < stage ? "text-text-3" : "text-line-strong",
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full transition-colors",
                      i === stage
                        ? kind === "place"
                          ? "bg-stencil shadow-[0_0_8px_var(--color-stencil)]"
                          : "bg-neon shadow-[0_0_8px_var(--color-neon)]"
                        : i < stage
                          ? "bg-text-3"
                          : "bg-line-strong",
                    )}
                  />
                  {t(s.label)}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="w-full max-w-[22rem] border-t border-line pt-5">
          <p className="t-label text-text-3">{t("ritual.tip.label")}</p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={tip}
              initial={{ opacity: 0, y: reduce ? 0 : 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="mt-2 min-h-[3em] text-[0.9375rem] text-text-2"
            >
              {t(tip)}
            </motion.p>
          </AnimatePresence>
          <p className="t-label mt-3 text-text-3">{t("ritual.hint")}</p>
        </div>
      </div>
    </motion.div>
  );
}
