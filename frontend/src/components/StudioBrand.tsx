import { Check } from "lucide-react";
import { useState } from "react";

import { buttonClass } from "@/components/ui/Button";
import { setBrand } from "@/lib/api";
import { useT } from "@/lib/useT";

/** Studio-plan brand stamped on exports. Shared by the account page. */
export function StudioBrand({ initial }: { initial: string }) {
  const t = useT();
  const [val, setVal] = useState(initial);
  const [saved, setSaved] = useState(false);
  return (
    <div>
      <label htmlFor="studio-brand" className="t-label text-text-3">
        {t("studio.brand.label")}
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="studio-brand"
          value={val}
          onChange={(e) => {
            setVal(e.target.value);
            setSaved(false);
          }}
          placeholder={t("studio.brand.placeholder")}
          maxLength={60}
          className="h-11 min-w-0 flex-1 rounded-full bg-raised px-4 text-[0.9375rem] text-text shadow-[inset_0_0_0_1px_var(--color-line)] outline-none focus:shadow-[inset_0_0_0_1.5px_var(--color-text-3)]"
        />
        <button
          type="button"
          onClick={async () => {
            try {
              await setBrand(val.trim());
              setSaved(true);
            } catch {
              /* ignore */
            }
          }}
          className={buttonClass("paper", "md")}
        >
          {saved ? <Check aria-label="saved" className="h-4 w-4" /> : t("common.save")}
        </button>
      </div>
    </div>
  );
}
