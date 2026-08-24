import { Compass, LayoutGrid, ScanFace, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { NavLink } from "react-router-dom";

import { cn } from "@/lib/cn";
import type { DictKey } from "@/lib/i18n";
import { useLangPath, useT } from "@/lib/useT";

export const NAV_ITEMS: { to: string; icon: typeof Sparkles; key: DictKey; end: boolean }[] = [
  { to: "/", icon: Sparkles, key: "nav.create", end: true },
  { to: "/explore", icon: Compass, key: "nav.explore", end: false },
  { to: "/studio", icon: ScanFace, key: "nav.tryOn", end: false },
  { to: "/gallery", icon: LayoutGrid, key: "nav.ink", end: false },
];

export function BottomNav() {
  const t = useT();
  const lp = useLangPath();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      <div className="flex items-center rounded-blob border border-white/10 bg-ink-850/85 py-1.5 shadow-[0_-8px_32px_-12px_rgba(0,0,0,0.8)] backdrop-blur-xl">
        {NAV_ITEMS.map(({ to, icon: Icon, key, end }) => (
          <NavLink
            key={to}
            to={lp(to)}
            end={end}
            className={({ isActive }) =>
              cn(
                "relative flex flex-1 flex-col items-center gap-1 px-2 py-1.5 font-display text-[10px] font-semibold transition-colors",
                isActive ? "text-acid" : "text-white/45 hover:text-white/70",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={cn(
                    "h-5 w-5 transition-transform",
                    isActive && "-translate-y-0.5 drop-shadow-[0_0_8px_var(--color-acid)]",
                  )}
                />
                {t(key)}
                {isActive && (
                  <motion.span
                    layoutId="nav-dot"
                    className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-acid shadow-[0_0_8px_var(--color-acid)]"
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
