import { LayoutGrid, ScanFace, Sparkles } from "lucide-react";
import { NavLink } from "react-router-dom";

import { cn } from "@/lib/cn";
import type { DictKey } from "@/lib/i18n";
import { useLangPath, useT } from "@/lib/useT";

export const NAV_ITEMS: { to: string; icon: typeof Sparkles; key: DictKey; end: boolean }[] = [
  { to: "/", icon: Sparkles, key: "nav.create", end: true },
  { to: "/studio", icon: ScanFace, key: "nav.tryOn", end: false },
  { to: "/gallery", icon: LayoutGrid, key: "nav.ink", end: false },
];

export function BottomNav() {
  const t = useT();
  const lp = useLangPath();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      <div className="flex items-center justify-around rounded-blob border border-white/10 bg-ink-850/80 py-1.5 backdrop-blur-xl">
        {NAV_ITEMS.map(({ to, icon: Icon, key, end }) => (
          <NavLink
            key={to}
            to={lp(to)}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-1 px-6 py-1.5 font-display text-[10px] font-semibold transition-colors",
                isActive ? "text-acid" : "text-white/45 hover:text-white/70",
              )
            }
          >
            <Icon className="h-5 w-5" />
            {t(key)}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
