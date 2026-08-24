import { motion, useReducedMotion } from "motion/react";

import { useT } from "@/lib/useT";

const ORBITERS = [
  { color: "bg-acid", dur: 3.2, inset: "inset-0" },
  { color: "bg-cyan", dur: 4.4, inset: "inset-6" },
  { color: "bg-magenta", dur: 5.6, inset: "inset-12" },
];

export function ConjuringRitual({ label }: { label?: string }) {
  const reduce = useReducedMotion();
  const t = useT();
  const text = label ?? t("ritual.default");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-ink-950/92 px-6 backdrop-blur-xl"
    >
      <div className="relative h-56 w-56">
        {/* morphing core */}
        <motion.div
          animate={reduce ? { opacity: [0.5, 0.9, 0.5] } : { rotate: 360, scale: [1, 1.14, 1] }}
          transition={{
            rotate: { duration: 9, repeat: Infinity, ease: "linear" },
            scale: { duration: 2.4, repeat: Infinity, ease: "easeInOut" },
            opacity: { duration: 2, repeat: Infinity, ease: "easeInOut" },
          }}
          className="absolute inset-8 rounded-full bg-gradient-to-br from-acid via-cyan to-magenta opacity-80 blur-2xl"
        />

        {/* expanding rings */}
        {!reduce &&
          [0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ scale: [0.5, 1.6], opacity: [0.5, 0] }}
              transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.85, ease: "easeOut" }}
              className="absolute inset-0 rounded-full border border-acid/40"
            />
          ))}

        {/* orbiting ink specks */}
        {!reduce &&
          ORBITERS.map((o, i) => (
            <motion.div
              key={i}
              className={`absolute ${o.inset}`}
              animate={{ rotate: 360 }}
              transition={{ duration: o.dur, repeat: Infinity, ease: "linear" }}
            >
              <span
                className={`absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full ${o.color} shadow-[0_0_12px_currentColor]`}
              />
            </motion.div>
          ))}
      </div>

      <motion.p
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mt-10 font-display text-lg font-extrabold tracking-tight"
      >
        <span className="bg-gradient-to-r from-acid via-cyan to-magenta bg-clip-text text-transparent">
          {text}
        </span>
      </motion.p>
      <p className="mt-1 text-xs text-white/40">{t("ritual.footer")}</p>
    </motion.div>
  );
}
