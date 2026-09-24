import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

/** Bottom sheet on flash paper — slides up from the thumb zone (a centered
 *  panel on desktop). Escape closes it. */
export function Sheet({ open, onClose, title, children }: Props) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/70"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={reduce ? { opacity: 0 } : { y: "100%" }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%" }}
            transition={{ type: "spring", damping: 34, stiffness: 380 }}
            className="paper fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[86dvh] w-full max-w-lg flex-col rounded-t-[22px] shadow-[0_-20px_60px_-10px_rgb(0_0_0/0.8)] md:bottom-6 md:rounded-[18px]"
          >
            <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-paper-ink/20" />
            {title && (
              <h2 className="heading shrink-0 px-5 pt-4 pb-2 text-[1.75rem] text-paper-ink">
                {title}
              </h2>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
