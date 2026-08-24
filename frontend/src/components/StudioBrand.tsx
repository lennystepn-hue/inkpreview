import { useState } from "react";

import { setBrand } from "@/lib/api";
import { useT } from "@/lib/useT";

/** Studio-plan brand stamped on exports. Shared by the account page. */
export function StudioBrand({ initial }: { initial: string }) {
  const t = useT();
  const [val, setVal] = useState(initial);
  const [saved, setSaved] = useState(false);
  return (
    <div>
      <p className="mb-1.5 text-xs tracking-wide text-white/35 uppercase">
        {t("studio.brand.label")}
      </p>
      <div className="flex gap-2">
        <input
          value={val}
          onChange={(e) => {
            setVal(e.target.value);
            setSaved(false);
          }}
          placeholder={t("studio.brand.placeholder")}
          maxLength={60}
          className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
        />
        <button
          onClick={async () => {
            try {
              await setBrand(val.trim());
              setSaved(true);
            } catch {
              /* ignore */
            }
          }}
          className="rounded-full bg-acid px-4 py-2 font-display text-xs font-bold text-ink-950"
        >
          {saved ? "✓" : t("common.save")}
        </button>
      </div>
    </div>
  );
}
