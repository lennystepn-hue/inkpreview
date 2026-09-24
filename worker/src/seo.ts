/**
 * Server-rendered public pages (SEO + social) — port of backend/app/routers/share.py:
 * per-design share pages (/d/:id), style & body-part landing pages (EN + DE) and
 * the dynamic sitemap with hreflang. Bots that don't run JS get full markup,
 * Open Graph tags and JSON-LD; every landing page cross-links styles ↔ body
 * parts (internal crawl mesh).
 *
 * Unlike the Python version, every interpolated value is HTML-escaped and
 * JSON-LD is "</script>"-safe (user prompts end up in these pages).
 */

import { type Design } from "./db/types";
import content from "./seo-content.json";
import { type StyleRecipe, allRecipes, getRecipe } from "./styles/catalog";

type Lang = "en" | "de";
type Faq = [string, string][];

const BODY_PARTS = content.bodyParts as unknown as Record<string, [string, string, string, string]>;
const UI = content.ui as unknown as Record<Lang, {
  examples: string;
  how: string;
  steps: string[];
  faq: string;
  styles: string;
  parts: string;
  cta: string;
  free: string;
}>;

export const bodyPartSlugs = () => Object.keys(BODY_PARTS);

/** Python ``html.escape(s, quote=True)``. */
export function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");
}

/** JSON for inside <script> — can't be closed early by user text. */
const ldJson = (block: unknown) =>
  JSON.stringify(block).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e").replaceAll("&", "\\u0026");

function fill(faq: Faq, name: string): Faq {
  const sub = (t: string) => t.replaceAll("\u0000NAME\u0000", name).replaceAll("\u0000name\u0000", name.toLowerCase());
  return faq.map(([q, a]) => [sub(q), sub(a)]);
}

const styleFaq = (name: string, lang: Lang): Faq => fill((content.styleFaq as unknown as Record<Lang, Faq>)[lang], name);
const partFaq = (name: string, lang: Lang): Faq => fill((content.partFaq as unknown as Record<Lang, Faq>)[lang], name);

const abs = (base: string, url: string | null): string => (!url ? "" : url.startsWith("http") ? url : `${base}${url}`);

const jsonldFaq = (faq: Faq) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
});

const jsonldBreadcrumbs = (base: string, crumbs: [string, string][]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: crumbs.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: `${base}${path}` })),
});

interface PageOpts {
  title: string;
  desc: string;
  img: string;
  url: string;
  base: string;
  body: string;
  lang?: Lang;
  altEn?: string;
  altDe?: string;
  jsonld?: unknown[];
}

function page(o: PageOpts): string {
  const lang = o.lang ?? "en";
  const t = esc(o.title);
  const d = esc(o.desc);
  const ui = UI[lang];
  const home = esc(`${o.base}${lang === "de" ? "/de" : "/"}`);
  const hreflang =
    o.altEn && o.altDe
      ? `<link rel="alternate" hreflang="en" href="${esc(o.base + o.altEn)}">` +
        `<link rel="alternate" hreflang="de" href="${esc(o.base + o.altDe)}">` +
        `<link rel="alternate" hreflang="x-default" href="${esc(o.base + o.altEn)}">`
      : "";
  const ld = (o.jsonld ?? []).map((b) => `<script type="application/ld+json">${ldJson(b)}</script>`).join("");
  return `<!doctype html>
<html lang="${lang}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t}</title>
<meta name="description" content="${d}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta property="og:type" content="website">
<meta property="og:site_name" content="InkPreview">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:image" content="${esc(o.img)}">
<meta property="og:url" content="${esc(o.url)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${esc(o.img)}">
<link rel="canonical" href="${esc(o.url)}">
${hreflang}
${ld}
<style>
  :root{color-scheme:dark}
  *{box-sizing:border-box}
  body{margin:0;background:#07070a;color:#fff;
    font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.6}
  main{max-width:680px;margin:0 auto;padding:40px 22px 60px}
  header.site{display:flex;justify-content:space-between;align-items:center;
    padding:14px 22px;border-bottom:1px solid rgba(198,255,26,.15)}
  header.site a{color:#fff;text-decoration:none;font-weight:800;font-size:14px;
    letter-spacing:.02em}
  header.site a span{color:#c6fb50}
  h1{font-size:30px;font-weight:800;line-height:1.15;margin:18px 0 10px}
  h2{font-size:19px;font-weight:800;margin:38px 0 12px}
  p{color:rgba(255,255,255,.6);font-size:15px;margin:0 0 14px}
  .lead{font-size:16px;color:rgba(255,255,255,.7)}
  .eyebrow{color:rgba(198,255,26,.75);font-size:11px;font-weight:700;
    letter-spacing:.25em;text-transform:uppercase;margin:0}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0}
  .grid a{display:block;background:#fff;border-radius:14px;overflow:hidden;aspect-ratio:1;
    border:1px solid rgba(255,255,255,.08)}
  .grid img{width:100%;height:100%;object-fit:contain;padding:6px}
  ol{padding-left:20px;color:rgba(255,255,255,.7);font-size:15px}
  ol li{margin-bottom:8px}
  details{border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:13px 16px;
    margin-bottom:10px}
  summary{font-weight:700;font-size:14.5px;cursor:pointer;color:rgba(255,255,255,.85)}
  details p{margin:10px 0 2px;font-size:14px}
  .mesh{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}
  .mesh a{color:rgba(255,255,255,.65);text-decoration:none;font-size:13px;
    border:1px solid rgba(255,255,255,.14);
    border-radius:999px;padding:6px 13px}
  .mesh a:hover{color:#c6fb50;border-color:rgba(198,255,26,.5)}
  .cta{display:block;text-align:center;background:#c6fb50;color:#07070a;font-weight:800;
    text-decoration:none;padding:15px 28px;border-radius:999px;margin:34px auto 8px;max-width:330px;
    box-shadow:0 0 42px -10px rgba(198,255,26,.6)}
  .sub{text-align:center;color:rgba(255,255,255,.35);font-size:12px}
  .art{background:#fff;border-radius:24px;padding:16px;
    border:1px solid rgba(255,255,255,.08);margin:18px 0}
  .art img{width:100%;height:auto;display:block;border-radius:12px}
  footer{text-align:center;color:rgba(255,255,255,.28);font-size:12px;padding:30px 0 40px}
</style></head>
<body>
<header class="site"><a href="${home}">INK<span>PREVIEW</span> ✦</a>
<a href="${home}"
 style="color:#c6fb50;font-size:13px">${esc(ui.cta)}</a></header>
<main>${o.body}
  <a class="cta"
   href="${home}"
  >${esc(ui.cta)}</a>
  <p class="sub">${esc(ui.free)}</p>
</main>
<footer>ink-preview.com</footer>
</body></html>`;
}

function grid(base: string, designs: Design[], limit = 9): string {
  const items = designs.slice(0, limit);
  if (!items.length) return "";
  const tiles = items
    .map(
      (d) =>
        `<a href="${esc(`${base}/d/${d.id}`)}"><img src="${esc(abs(base, d.thumb_url || d.clean_png_url))}"` +
        ` alt="${esc((d.prompt || "AI tattoo design").slice(0, 80))}" loading="lazy"></a>`,
    )
    .join("");
  return `<div class="grid">${tiles}</div>`;
}

const firstImg = (base: string, designs: Design[]) =>
  designs.length ? abs(base, designs[0].clean_png_url || designs[0].thumb_url) : `${base}/og.png`;

function faqHtml(faq: Faq, heading: string): string {
  const items = faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("");
  return `<h2>${esc(heading)}</h2>${items}`;
}

function howHtml(lang: Lang): string {
  const ui = UI[lang];
  return `<h2>${esc(ui.how)}</h2><ol>${ui.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>`;
}

/** Cross-link styles ↔ body parts — the internal crawl mesh. */
function meshHtml(base: string, lang: Lang, skip: { style?: string; part?: string } = {}): string {
  const ui = UI[lang];
  const prefix = lang === "de" ? "/de" : "";
  const styleLinks = allRecipes()
    .filter((r) => r.slug !== skip.style)
    .slice(0, 10)
    .map((r) => `<a href="${esc(`${base}${prefix}/style/${r.slug}`)}">${esc(r.name)}</a>`)
    .join("");
  const partLinks = Object.entries(BODY_PARTS)
    .filter(([slug]) => slug !== skip.part)
    .map(([slug, names]) => `<a href="${esc(`${base}${prefix}/tattoo/${slug}`)}">${esc(lang === "de" ? names[1] : names[0])}</a>`)
    .join("");
  return (
    `<h2>${esc(ui.styles)}</h2><nav class='mesh'>${styleLinks}</nav>` +
    `<h2>${esc(ui.parts)}</h2><nav class='mesh'>${partLinks}</nav>`
  );
}

export interface HtmlPage {
  html: string;
  status: number;
}

function notFound(base: string, url: string): HtmlPage {
  return {
    status: 404,
    html: page({
      title: "Not found | InkPreview",
      desc: "AI tattoo designer — see your tattoo on your own skin before the needle.",
      img: `${base}/og.png`,
      url,
      base,
      body: "<h1>Not found</h1><p>This page may have moved.</p>",
    }),
  };
}

export function sharePage(base: string, designId: string, design: Design | null, recentDone: Design[]): HtmlPage {
  if (!design || design.status !== "done" || !design.clean_png_url) return notFound(base, `${base}/d/${designId}`);
  const prompt = (design.prompt || "").trim();
  const img = abs(base, design.clean_png_url);
  const title = prompt ? `InkPreview — ${prompt.slice(0, 60)}` : "InkPreview — AI tattoo design";
  const desc = prompt
    ? `AI tattoo flash: ${prompt.slice(0, 120)}. Preview it on your own skin and export an artist-ready file — free, no signup.`
    : "An AI-generated tattoo design. Make your own in seconds.";
  const recent = recentDone.filter((d) => d.id !== design.id);
  const jsonld = [
    {
      "@context": "https://schema.org",
      "@type": "ImageObject",
      contentUrl: img,
      name: title,
      description: desc,
      creator: { "@type": "Organization", name: "InkPreview" },
      creditText: "InkPreview — AI tattoo designer",
      license: `${base}/agb`,
    },
    jsonldBreadcrumbs(base, [
      ["InkPreview", "/"],
      ["Explore", "/explore"],
      [prompt.slice(0, 40) || "Design", `/d/${design.id}`],
    ]),
  ];
  const body =
    `<p class="eyebrow">✦ AI Tattoo Flash</p>` +
    `<h1>${esc(prompt.slice(0, 80) || "AI tattoo design")}</h1>` +
    `<div class="art"><img src="${esc(img)}" alt="${esc(desc.slice(0, 100))}"></div>` +
    `<p class="lead">${esc(desc)}</p>` +
    `<h2>${esc(UI.en.examples)}</h2>${grid(base, recent, 6)}` +
    howHtml("en") +
    meshHtml(base, "en");
  return { status: 200, html: page({ title, desc, img, url: `${base}/d/${design.id}`, base, body, jsonld }) };
}

export function stylePage(base: string, slug: string, lang: Lang, recentDone: Design[]): HtmlPage {
  const prefix = lang === "de" ? "/de" : "";
  const recipe: StyleRecipe | undefined = getRecipe(slug);
  if (!recipe) return notFound(base, `${base}${prefix}/style/${slug}`);
  const matching = recentDone.filter((d) => (d.styles ?? []).includes(slug));
  const examples = matching.length ? matching : recentDone;
  const ui = UI[lang];
  let title: string, desc: string, h1: string, lead: string;
  if (lang === "de") {
    title = `${recipe.name} Tattoo Designs mit KI erstellen + an dir testen | InkPreview`;
    desc = (
      `${recipe.name}-Tattoos mit KI entwerfen und fotorealistisch auf deiner eigenen ` +
      "Haut testen. Artist-Datei + Stencil exportieren — kostenlos, ohne Anmeldung."
    ).slice(0, 155);
    h1 = `${recipe.name} Tattoos`;
    lead =
      `${recipe.description} Mit InkPreview entwirfst du ${recipe.name}-Designs per KI, ` +
      "testest sie fotorealistisch an deiner eigenen Haut und nimmst eine druckfertige " +
      "Artist-Datei mit ins Studio.";
  } else {
    title = `${recipe.name} Tattoos — AI Designs & Skin Preview | InkPreview`;
    desc = (
      `Generate ${recipe.name} tattoo designs with AI and preview them photorealistically ` +
      "on your own skin. Export an artist file + stencil — free, no signup."
    ).slice(0, 155);
    h1 = `${recipe.name} tattoos`;
    lead =
      `${recipe.description} With InkPreview you design ${recipe.name} pieces with AI, ` +
      "preview them photorealistically on your own skin, and walk into the studio with a " +
      "print-ready artist file.";
  }
  const faq = styleFaq(recipe.name, lang);
  const crumbsRoot = lang === "de" ? "Stile" : "Styles";
  const jsonld = [
    jsonldFaq(faq),
    jsonldBreadcrumbs(base, [
      ["InkPreview", prefix || "/"],
      [crumbsRoot, `${prefix}/style/${slug}`],
      [recipe.name, `${prefix}/style/${slug}`],
    ]),
  ];
  const body =
    `<p class="eyebrow">✦ ${esc(crumbsRoot)}</p>` +
    `<h1>${esc(h1)}</h1>` +
    `<p class="lead">${esc(lead)}</p>` +
    `<h2>${esc(ui.examples)}</h2>${grid(base, examples)}` +
    howHtml(lang) +
    faqHtml(faq, ui.faq) +
    meshHtml(base, lang, { style: slug });
  return {
    status: 200,
    html: page({
      title,
      desc,
      img: firstImg(base, examples),
      url: `${base}${prefix}/style/${slug}`,
      base,
      body,
      lang,
      altEn: `/style/${slug}`,
      altDe: `/de/style/${slug}`,
      jsonld,
    }),
  };
}

export function bodyPartPage(base: string, part: string, lang: Lang, recentDone: Design[]): HtmlPage {
  const prefix = lang === "de" ? "/de" : "";
  const info = Object.hasOwn(BODY_PARTS, part) ? BODY_PARTS[part] : undefined;
  if (!info) return notFound(base, `${base}${prefix}/tattoo/${part}`);
  const [enName, deName, enIntro, deIntro] = info;
  const name = lang === "de" ? deName : enName;
  const ui = UI[lang];
  let title: string, desc: string, h1: string, lead: string, crumbsRoot: string;
  if (lang === "de") {
    title = `${name}-Tattoo: Ideen + Vorschau auf deiner Haut | InkPreview`;
    desc = (
      `${name}-Tattoo gesucht? Entwirf Motive mit KI und sieh sie fotorealistisch an ` +
      `deinem eigenen ${name}, bevor du stichst. Kostenlos testen.`
    ).slice(0, 155);
    h1 = `${name}-Tattoo: Ideen & Vorschau`;
    lead = deIntro;
    crumbsRoot = "Körperstellen";
  } else {
    title = `${name} Tattoo Ideas — Preview On Your Own Skin | InkPreview`;
    desc = (
      `Looking for a ${name.toLowerCase()} tattoo? Design with AI and see it photorealistically ` +
      `on your own ${name.toLowerCase()} before you commit. Free to try.`
    ).slice(0, 155);
    h1 = `${name} tattoo ideas & preview`;
    lead = enIntro;
    crumbsRoot = "Placements";
  }
  const faq = partFaq(name, lang);
  const jsonld = [
    jsonldFaq(faq),
    jsonldBreadcrumbs(base, [
      ["InkPreview", prefix || "/"],
      [crumbsRoot, `${prefix}/tattoo/${part}`],
      [name, `${prefix}/tattoo/${part}`],
    ]),
  ];
  const body =
    `<p class="eyebrow">✦ ${esc(crumbsRoot)}</p>` +
    `<h1>${esc(h1)}</h1>` +
    `<p class="lead">${esc(lead)}</p>` +
    `<h2>${esc(ui.examples)}</h2>${grid(base, recentDone)}` +
    howHtml(lang) +
    faqHtml(faq, ui.faq) +
    meshHtml(base, lang, { part });
  return {
    status: 200,
    html: page({
      title,
      desc,
      img: firstImg(base, recentDone),
      url: `${base}${prefix}/tattoo/${part}`,
      base,
      body,
      lang,
      altEn: `/tattoo/${part}`,
      altDe: `/de/tattoo/${part}`,
      jsonld,
    }),
  };
}

/** Dynamic sitemap — every page, with hreflang pairs for the EN/DE variants. */
export function sitemapXml(base: string): string {
  const alt = (en: string, de: string) =>
    `<xhtml:link rel="alternate" hreflang="en" href="${base}${en}"/>` +
    `<xhtml:link rel="alternate" hreflang="de" href="${base}${de}"/>` +
    `<xhtml:link rel="alternate" hreflang="x-default" href="${base}${en}"/>`;
  const u = (loc: string, priority: string, freq = "weekly", a = "") =>
    `<url><loc>${base}${loc}</loc>${a}<changefreq>${freq}</changefreq><priority>${priority}</priority></url>`;
  const parts = [
    u("/", "1.0", "weekly", alt("/", "/de")),
    u("/de", "0.9", "weekly", alt("/", "/de")),
    u("/explore", "0.8", "daily", alt("/explore", "/de/explore")),
    u("/de/explore", "0.7", "daily", alt("/explore", "/de/explore")),
    u("/pricing", "0.7", "weekly", alt("/pricing", "/de/pricing")),
    u("/de/pricing", "0.6", "weekly", alt("/pricing", "/de/pricing")),
    u("/impressum", "0.3", "yearly"),
    u("/datenschutz", "0.3", "yearly"),
    u("/agb", "0.3", "yearly"),
  ];
  for (const r of allRecipes()) {
    const a = alt(`/style/${r.slug}`, `/de/style/${r.slug}`);
    parts.push(u(`/style/${r.slug}`, "0.6", "weekly", a), u(`/de/style/${r.slug}`, "0.6", "weekly", a));
  }
  for (const slug of Object.keys(BODY_PARTS)) {
    const a = alt(`/tattoo/${slug}`, `/de/tattoo/${slug}`);
    parts.push(u(`/tattoo/${slug}`, "0.6", "weekly", a), u(`/de/tattoo/${slug}`, "0.6", "weekly", a));
  }
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ' +
    'xmlns:xhtml="http://www.w3.org/1999/xhtml">' +
    parts.join("") +
    "</urlset>"
  );
}
