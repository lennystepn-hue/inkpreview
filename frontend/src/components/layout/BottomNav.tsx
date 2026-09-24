import { BookOpen, Compass, PenTool, PersonStanding } from "lucide-react";
import { NavLink } from "react-router-dom";

import { cn } from "@/lib/cn";
import type { DictKey } from "@/lib/i18n";
import { useLangPath, useT } from "@/lib/useT";

export const NAV_ITEMS: { to: string; icon: typeof PenTool; key: DictKey; end: boolean }[] = [
  { to: "/", icon: PenTool, key: "nav.create", end: true },
  { to: "/explore", icon: Compass, key: "nav.explore", end: false },
  { to: "/studio", icon: PersonStanding, key: "nav.tryOn", end: false },
  { to: "/gallery", icon: BookOpen, key: "nav.ink", end: false },
];

/** Mobile tab bar, docked to the bottom edge (never floating over content). */
export function BottomNav() {
  const t = useT();
  const lp = useLangPath();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-wall/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-4">
        {NAV_ITEMS.map(({ to, icon: Icon, key, end }) => (
          <NavLink
            key={to}
            to={lp(to)}
            end={end}
            className={({ isActive }) =>
              cn(
                "relative flex h-[3.75rem] flex-col items-center justify-center gap-1 font-sans cond text-[0.6875rem] font-bold tracking-[0.06em] uppercase transition-colors",
                isActive ? "text-text" : "text-text-3 hover:text-text-2",
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute top-0 h-[3px] w-9 rounded-b-full bg-neon shadow-[0_0_12px_2px_color-mix(in_srgb,var(--color-neon)_70%,transparent)]"
                  />
                )}
                <Icon
                  aria-hidden
                  strokeWidth={isActive ? 2.25 : 1.75}
                  className={cn("h-[1.35rem] w-[1.35rem]", isActive && "text-neon-hi")}
                />
                {t(key)}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
