import { Check } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Sheet } from "@/components/ui/Sheet";
import type { Style } from "@/lib/api";
import { useT } from "@/lib/useT";

type Props = {
  open: boolean;
  onClose: () => void;
  styles: Style[];
  selected: string[];
  onToggle: (slug: string) => void;
};

/** The style book: every style grouped by family, on paper. */
export function StyleSheet({ open, onClose, styles, selected, onToggle }: Props) {
  const t = useT();
  const byCat = new Map<string, Style[]>();
  for (const s of styles) {
    const list = byCat.get(s.category) ?? [];
    list.push(s);
    byCat.set(s.category, list);
  }

  return (
    <Sheet open={open} onClose={onClose} title={t("styleSheet.title")}>
      <div className="flex flex-col gap-6 pt-2 pb-4">
        {[...byCat.entries()].map(([cat, list]) => (
          <div key={cat} className="flex flex-col gap-2.5">
            <p className="t-label border-b-[1.5px] border-dashed border-paper-line pb-2 text-paper-mute">
              {cat}
            </p>
            <div className="flex flex-wrap gap-2">
              {list.map((s) => {
                const on = selected.includes(s.slug);
                return (
                  <Chip key={s.slug} tone="paper" selected={on} onClick={() => onToggle(s.slug)}>
                    {on && <Check aria-hidden className="h-3.5 w-3.5" />}
                    {s.name}
                  </Chip>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="sticky bottom-0 -mx-5 bg-gradient-to-t from-paper via-paper to-transparent px-5 pt-4 pb-1">
        <Button variant="ink" size="lg" className="w-full" onClick={onClose}>
          {t("styleSheet.done", { count: selected.length })}
        </Button>
      </div>
    </Sheet>
  );
}
