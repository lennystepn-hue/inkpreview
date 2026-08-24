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
      <div className="flex flex-col gap-5">
        {[...byCat.entries()].map(([cat, list]) => (
          <div key={cat}>
            <p className="mb-2 text-xs tracking-wide text-white/35 uppercase">{cat}</p>
            <div className="flex flex-wrap gap-2">
              {list.map((s, i) => (
                <Chip
                  key={s.slug}
                  tilt={(i % 3) - 1}
                  selected={selected.includes(s.slug)}
                  onClick={() => onToggle(s.slug)}
                >
                  {s.name}
                </Chip>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={onClose}
        className="mt-5 w-full rounded-blob bg-acid py-3.5 font-display text-sm font-extrabold text-ink-950"
      >
        {t("styleSheet.done", { count: selected.length })}
      </button>
    </Sheet>
  );
}
