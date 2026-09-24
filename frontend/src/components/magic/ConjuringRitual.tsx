import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";
import type { DictKey } from "@/lib/i18n";
import { useT } from "@/lib/useT";

// Line art that cycles through the printer while a new design is being drawn.
const MOTIFS = [
  "/ink/rose.png",
  "/ink/swallow.png",
  "/ink/dagger.png",
  "/ink/moth.png",
  "/ink/eye.png",
  "/ink/moon.png",
  "/ink/snake.png",
  "/ink/mountains.png",
];

const GEN_STEPS: DictKey[] = ["ritual.gen.1", "ritual.gen.2", "ritual.gen.3"];
const PLACE_STEPS: DictKey[] = ["ritual.place.1", "ritual.place.2", "ritual.place.3"];

const PRINT_MS = 2600; // one pass of the print head
const CYCLE_MS = 3400; // pass + a beat to admire it
const STEP_MS = 7000; // status line advances, then rests on the last step

type Props = {
  label?: string;
  /** "draw": a new design is being generated. "place": the design goes onto skin. */
  mode?: "draw" | "place";
  /** The design being stenciled (place mode) — printed in stencil violet. */
  motif?: string | null;
};

/** Full-screen wait state — a thermal stencil printer running off flash
 *  sheets, with the shop's real steps as the status line. */
export function ConjuringRitual({ label, mode = "draw", motif }: Props) {
  const reduce = useReducedMotion();
  const t = useT();
  const [tick, setTick] = useState(0);
  const [step, setStep] = useState(0);
  const steps = mode === "place" ? PLACE_STEPS : GEN_STEPS;
  const own = mode === "place" && motif;

  useEffect(() => {
    const cycle = window.setInterval(() => setTick((n) => n + 1), CYCLE_MS);
    const advance = window.setInterval(
      () => setStep((n) => Math.min(n + 1, steps.length - 1)),
      STEP_MS,
    );
    return () => {
      window.clearInterval(cycle);
      window.clearInterval(advance);
    };
  }, [steps.length]);

  const src = own ? motif : MOTIFS[tick % MOTIFS.length];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-ground px-6 text-center"
    >
      <div className="relative w-[min(62vw,16rem)]">
        <div className="flash-card overflow-hidden" style={{ rotate: "-2deg" }}>
          <span aria-hidden className="tape tape-t" />
          <div className="relative aspect-square">
            <img
              key={`${src}-${tick}`}
              src={src ?? ""}
              alt=""
              draggable={false}
              className={cn(
                "absolute inset-0 h-full w-full object-contain",
                own ? "stencil-ghost p-[12%]" : "flash-art p-[16%]",
              )}
              style={reduce ? undefined : { animation: `print-reveal ${PRINT_MS}ms linear both` }}
            />
            {!reduce && (
              <span
                key={`head-${tick}`}
                aria-hidden
                className={cn(
                  "absolute inset-x-[4%] h-[2px] rounded-full",
                  own
                    ? "bg-stencil shadow-[0_0_14px_2px_var(--color-stencil)]"
                    : "bg-neon shadow-[0_0_14px_2px_var(--color-neon)]",
                )}
                style={{ animation: `print-head ${PRINT_MS}ms linear both` }}
              />
            )}
          </div>
        </div>
      </div>

      <h2 className="heading mt-12 text-[2rem] text-text md:text-[2.5rem]">
        {label ?? t("ritual.default")}
      </h2>
      <p role="status" aria-live="polite" className="typewriter mt-3 text-[0.9375rem] text-text-2">
        {t(steps[step])}
        <span aria-hidden className="motion-safe:animate-[blink_1s_steps(1,end)_infinite]">
          _
        </span>
      </p>
      <p className="gothic mt-10 text-[1.75rem] text-text-3">{t("ritual.footer")}</p>
    </motion.div>
  );
}
