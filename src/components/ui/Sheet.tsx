import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

/** Mobile-first bottom sheet. Slides up from the thumb zone. */
export function Sheet({ open, onClose, title, children }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 360 }}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] border-t border-white/10 bg-ink-900/95 px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl"
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-white/20" />
            {title && (
              <h2 className="mb-3 font-display text-lg font-extrabold tracking-tight">{title}</h2>
            )}
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
