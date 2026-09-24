import { Label } from "@/components/ui/Label";
import { cn } from "@/lib/cn";
import type { DictKey } from "@/lib/i18n";
import { useT } from "@/lib/useT";

const ART = "/flash/snake-dagger.webp";

/** Sketch → stencil → ink: the three things that happen in a real shop,
 *  each shown as the material it produces. */
function StepArt({ step }: { step: 1 | 2 | 3 }) {
  if (step === 1)
    return (
      <div className="flash-card aspect-[4/5] w-full rotate-[-2deg]">
        <span aria-hidden className="tape tape-t" />
        <img src={ART} alt="" className="flash-art h-full w-full object-contain p-[12%]" />
      </div>
    );
  if (step === 2)
    return (
      <div className="flash-card aspect-[4/5] w-full rotate-[1.5deg] bg-[#f4f1fb]!">
        <span aria-hidden className="tape tape-t" />
        <img src={ART} alt="" className="stencil-ghost h-full w-full object-contain p-[12%]" />
      </div>
    );
  return (
    <div className="relative aspect-[4/5] w-full rotate-[-1deg] overflow-hidden rounded-[18px] bg-[radial-gradient(120%_90%_at_35%_30%,#e2b89c,#c99576_55%,#a8765a)] shadow-[var(--shadow-paper)]">
      <img
        src={ART}
        alt=""
        className="h-full w-full object-contain p-[14%] opacity-[0.88] mix-blend-multiply"
      />
    </div>
  );
}

const STEPS: { n: 1 | 2 | 3; title: DictKey; body: DictKey }[] = [
  { n: 1, title: "create.how.1.title", body: "create.how.1.body" },
  { n: 2, title: "create.how.2.title", body: "create.how.2.body" },
  { n: 3, title: "create.how.3.title", body: "create.how.3.body" },
];

export function HowItWorks({ className }: { className?: string }) {
  const t = useT();
  return (
    <section className={cn(className)} aria-labelledby="how-title">
      <div className="flex flex-col gap-3">
        <Label dot="neon">{t("create.how.label")}</Label>
        <h2 id="how-title" className="heading max-w-[18ch] text-[2rem] text-text md:text-5xl">
          {t("create.how.title")}
        </h2>
      </div>
      <ol className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8 lg:gap-12">
        {STEPS.map((s) => (
          <li
            key={s.n}
            className="grid grid-cols-[6.5rem_1fr] items-center gap-5 md:grid-cols-1 md:items-start"
          >
            <div className="md:max-w-[15rem]">
              <StepArt step={s.n} />
            </div>
            <div className="flex flex-col gap-2">
              <span className="t-label text-text-3">{String(s.n).padStart(2, "0")}</span>
              <h3 className="gothic text-[2.25rem] text-paper">{t(s.title)}</h3>
              <p className="max-w-[34ch] text-[0.9375rem] text-text-2">{t(s.body)}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
