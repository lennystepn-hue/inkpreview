"""Server-rendered public pages (SEO + social): per-design share pages, style &
body-part landing pages (EN + DE), and a dynamic sitemap with hreflang.

Served by the backend (not the SPA) so bots that don't run JS get full markup,
Open Graph tags, and JSON-LD (BreadcrumbList + FAQPage). Routed via Caddy
(/d/*, /style/*, /tattoo/*, /de/style/*, /de/tattoo/*, /sitemap.xml → backend).
Every landing page cross-links styles ↔ body parts to build a crawl mesh.
"""

import html
import json

from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse, Response
from sqlalchemy import select

from app.config import Settings, get_settings
from app.db import get_session
from app.models import Design, JobStatus
from app.styles.catalog import all_recipes, get_recipe

router = APIRouter(tags=["share"])

# Common placements people search for: slug -> (EN name, DE name, EN intro, DE intro).
_BODY_PARTS: dict[str, tuple[str, str, str, str]] = {
    "forearm": (
        "Forearm",
        "Unterarm",
        "The forearm is one of the most popular tattoo placements: highly visible, easy to "
        "show or cover, and relatively low on pain. Long motifs, lettering, and fine-line "
        "pieces work beautifully along the inner or outer forearm.",
        "Der Unterarm ist eine der beliebtesten Tattoo-Stellen: gut sichtbar, leicht zu zeigen "
        "oder zu verdecken und vergleichsweise schmerzarm. Längliche Motive, Lettering und "
        "Fine-Line-Designs wirken an der Innen- wie Außenseite besonders gut.",
    ),
    "wrist": (
        "Wrist",
        "Handgelenk",
        "Wrist tattoos are small, personal, and always in view. Minimal symbols, thin script, "
        "and delicate fine-line work suit the narrow canvas — sizing matters a lot here, so "
        "previewing on your own wrist first pays off.",
        "Handgelenk-Tattoos sind klein, persönlich und immer im Blick. Minimalistische Symbole, "
        "feine Schrift und zarte Fine-Line-Motive passen perfekt auf die schmale Fläche — die "
        "Größe ist hier entscheidend, eine Vorschau am eigenen Handgelenk lohnt sich.",
    ),
    "upper-arm": (
        "Upper arm",
        "Oberarm",
        "The upper arm offers a big, forgiving canvas with low pain levels — ideal for a first "
        "tattoo. It suits bold traditional pieces, portraits, and designs that may grow into a "
        "half or full sleeve later.",
        "Der Oberarm bietet eine große, unkomplizierte Fläche mit geringem Schmerzlevel — ideal "
        "fürs erste Tattoo. Er eignet sich für kräftige Traditional-Motive, Porträts und Designs, "
        "die später zu einem Half- oder Full-Sleeve wachsen können.",
    ),
    "shoulder": (
        "Shoulder",
        "Schulter",
        "Shoulder tattoos flow with the body's roundest contour. Mandalas, florals, and "
        "ornamental pieces drape naturally over the deltoid and can extend toward chest or back.",
        "Schulter-Tattoos folgen der rundesten Kontur des Körpers. Mandalas, florale und "
        "ornamentale Motive legen sich natürlich über den Deltamuskel und lassen sich Richtung "
        "Brust oder Rücken erweitern.",
    ),
    "back": (
        "Back",
        "Rücken",
        "The back is the largest canvas on the body — home of full-scale art, symmetrical "
        "compositions, and pieces that need room to breathe. Even small designs benefit from "
        "testing placement between the shoulder blades or along the spine.",
        "Der Rücken ist die größte Leinwand des Körpers — der Platz für großflächige Kunst, "
        "symmetrische Kompositionen und Motive, die Raum brauchen. Auch kleine Designs profitieren "
        "von einem Platzierungstest zwischen den Schulterblättern oder entlang der Wirbelsäule.",
    ),
    "chest": (
        "Chest",
        "Brust",
        "Chest tattoos sit close to the heart — literally. Symmetrical designs, script, and "
        "bold statement pieces work well; expect more sensitivity near the sternum and collarbone.",
        "Brust-Tattoos sitzen nah am Herzen — im Wortsinn. Symmetrische Designs, Schriftzüge und "
        "markante Statement-Motive wirken hier stark; in Richtung Brustbein und Schlüsselbein ist "
        "die Haut empfindlicher.",
    ),
    "calf": (
        "Calf",
        "Wade",
        "The calf gives you a tall, curved canvas with moderate pain. Vertical motifs — daggers, "
        "botanicals, animals in motion — follow the muscle's shape naturally.",
        "Die Wade bietet eine hohe, gewölbte Fläche bei moderatem Schmerz. Vertikale Motive — "
        "Dolche, Pflanzen, Tiere in Bewegung — folgen der Muskelform ganz natürlich.",
    ),
    "ankle": (
        "Ankle",
        "Knöchel",
        "Ankle tattoos are subtle and easy to conceal. Small symbols, thin bands, and delicate "
        "florals fit the spot; the skin is thin here, so crisp fine-line designs shine.",
        "Knöchel-Tattoos sind dezent und leicht zu verdecken. Kleine Symbole, schmale Bänder und "
        "zarte Blumenmotive passen perfekt; die Haut ist dünn, daher wirken präzise "
        "Fine-Line-Designs hier besonders klar.",
    ),
    "hand": (
        "Hand",
        "Hand",
        "Hand tattoos are bold and always visible — a real commitment. Preview placement and "
        "size carefully: small ornaments, finger details, and strong linework age best here.",
        "Hand-Tattoos sind ein Statement und immer sichtbar — ein echtes Commitment. Teste "
        "Platzierung und Größe genau: kleine Ornamente, Finger-Details und kräftige Linien "
        "altern hier am besten.",
    ),
    "neck": (
        "Neck",
        "Hals",
        "Neck tattoos make a statement you can't tuck away. Side-neck script, small symbols "
        "behind the ear, and ornamental nape pieces are popular — preview size carefully before "
        "committing.",
        "Hals-Tattoos sind ein Statement, das sich nicht verstecken lässt. Schriftzüge seitlich, "
        "kleine Symbole hinterm Ohr und ornamentale Nacken-Motive sind beliebt — prüfe die Größe "
        "genau, bevor du dich festlegst.",
    ),
    "ribs": (
        "Ribs",
        "Rippen",
        "Rib tattoos are intimate and dramatic — and famously among the more painful spots. "
        "Flowing designs, script, and botanical pieces follow the ribcage's natural curve.",
        "Rippen-Tattoos sind intim und dramatisch — und bekanntlich eine der schmerzhafteren "
        "Stellen. Fließende Designs, Schriftzüge und florale Motive folgen der natürlichen "
        "Krümmung des Brustkorbs.",
    ),
    "thigh": (
        "Thigh",
        "Oberschenkel",
        "The thigh offers a large, private canvas with mild pain — perfect for detailed pieces, "
        "big florals, and designs you choose to reveal. Placement high or low changes the look "
        "entirely, so preview both.",
        "Der Oberschenkel bietet eine große, private Fläche bei mildem Schmerz — perfekt für "
        "detailreiche Motive, große Blumen und Designs, die du gezielt zeigst. Ob weiter oben "
        "oder unten platziert, ändert die Wirkung komplett — teste beides in der Vorschau.",
    ),
}

_UI = {
    "en": {
        "examples": "Fresh examples from the community",
        "how": "How it works",
        "steps": [
            "Describe your tattoo — the AI generates a clean, artist-ready design.",
            "Snap or upload a photo of the spot and place, resize, and rotate it live.",
            "The AI inks it realistically into your skin — export the artist file + stencil.",
        ],
        "faq": "Frequently asked questions",
        "styles": "Explore tattoo styles",
        "parts": "Popular placements",
        "cta": "Create your own ✦",
        "free": "Free to try · no signup",
    },
    "de": {
        "examples": "Frische Beispiele aus der Community",
        "how": "So funktioniert's",
        "steps": [
            "Beschreibe dein Tattoo — die KI erstellt ein sauberes, artist-ready Design.",
            "Foto der Stelle aufnehmen oder hochladen, dann live platzieren, skalieren, drehen.",
            "Die KI sticht es realistisch in deine Haut — Artist-Datei + Stencil exportieren.",
        ],
        "faq": "Häufige Fragen",
        "styles": "Tattoo-Stile entdecken",
        "parts": "Beliebte Körperstellen",
        "cta": "Eigenes erstellen ✦",
        "free": "Kostenlos testen · ohne Anmeldung",
    },
}


def _style_faq(name: str, lang: str) -> list[tuple[str, str]]:
    if lang == "de":
        return [
            (
                f"Kann eine KI ein {name}-Tattoo entwerfen?",
                f"Ja. InkPreview generiert {name}-Tattoo-Designs aus deiner Beschreibung — als "
                "saubere, artist-ready Vorlage in Schwarz-Grau oder Farbe. Du kannst Detailgrad "
                "und Strichstärke einstellen und beliebig viele Varianten erstellen.",
            ),
            (
                f"Wie sehe ich, wie ein {name}-Tattoo an mir aussieht?",
                "Lade ein Foto der Körperstelle hoch oder nutze die Live-Kamera, platziere das "
                "Design per Fingertipp, skaliere und drehe es frei — die KI rendert es "
                "fotorealistisch in deine Haut, inklusive Verdeckung und 3D-Wölbung.",
            ),
            (
                "Kann mein Tattoo-Studio die Datei verwenden?",
                "Ja. Der Export enthält eine druckfertige Artist-Datei (2048 px, 300 DPI PNG) "
                "plus eine Stencil-Version für den Thermokopierer — genau das, womit Studios "
                "arbeiten.",
            ),
            (
                "Was kostet das?",
                "Der Einstieg ist kostenlos und ohne Anmeldung. Designs generieren und auf der "
                "eigenen Haut testen kannst du sofort im Browser.",
            ),
        ]
    return [
        (
            f"Can AI design a {name} tattoo?",
            f"Yes. InkPreview generates {name} tattoo designs from your description — clean, "
            "artist-ready flash in black-and-grey or color. You control detail level and line "
            "weight, and can spin up unlimited variants.",
        ),
        (
            f"How do I see what a {name} tattoo looks like on me?",
            "Upload a photo of the spot or use the live camera, tap to place the design, "
            "resize and rotate it freely — the AI renders it photorealistically into your "
            "skin with proper occlusion and 3D wrap.",
        ),
        (
            "Can my tattoo studio use the exported file?",
            "Yes. The export includes a print-ready artist file (2048 px, 300 DPI PNG) plus a "
            "stencil version for thermal printers — exactly what studios work with.",
        ),
        (
            "How much does it cost?",
            "Starting is free with no signup. You can generate designs and preview them on "
            "your own skin right in the browser.",
        ),
    ]


def _part_faq(name: str, lang: str) -> list[tuple[str, str]]:
    if lang == "de":
        return [
            (
                f"Wie finde ich die richtige Größe für ein {name}-Tattoo?",
                f"Mit InkPreview platzierst du dein Design direkt auf einem Foto deines "
                f"{name}s und skalierst es live — so siehst du sofort, welche Größe und "
                "Position wirklich passt, bevor du einen Termin buchst.",
            ),
            (
                f"Welche Motive passen auf den {name}?",
                "Die KI generiert jedes Motiv in jedem Stil — von Fine-Line bis Traditional. "
                "Probiere mehrere Varianten direkt an der Stelle aus und vergleiche sie.",
            ),
            (
                "Bekomme ich eine Datei für mein Studio?",
                "Ja — eine druckfertige Artist-Datei (2048 px, 300 DPI) plus Stencil-Version. "
                "Dein Artist sieht exakt, was du willst, inklusive Größe und Platzierung.",
            ),
        ]
    return [
        (
            f"How do I pick the right size for a {name.lower()} tattoo?",
            f"With InkPreview you place your design on a photo of your own {name.lower()} and "
            "scale it live — you instantly see which size and position actually works before "
            "booking an appointment.",
        ),
        (
            f"What designs work on the {name.lower()}?",
            "The AI generates any motif in any style — fine-line to traditional. Try several "
            "variants right on the spot and compare them side by side.",
        ),
        (
            "Do I get a file for my studio?",
            "Yes — a print-ready artist file (2048 px, 300 DPI) plus a stencil version. Your "
            "artist sees exactly what you want, including size and placement.",
        ),
    ]


def _abs(base: str, url: str | None) -> str:
    if not url:
        return ""
    return url if url.startswith("http") else f"{base}{url}"


def _jsonld_faq(faq: list[tuple[str, str]]) -> dict:
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": q,
                "acceptedAnswer": {"@type": "Answer", "text": a},
            }
            for q, a in faq
        ],
    }


def _jsonld_breadcrumbs(base: str, crumbs: list[tuple[str, str]]) -> dict:
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": name, "item": f"{base}{path}"}
            for i, (name, path) in enumerate(crumbs)
        ],
    }


def _page(
    *,
    title: str,
    desc: str,
    img: str,
    url: str,
    base: str,
    body: str,
    lang: str = "en",
    alt_en: str | None = None,
    alt_de: str | None = None,
    jsonld: list[dict] | None = None,
    cta_href: str | None = None,
    cta_label: str | None = None,
) -> str:
    t, d = html.escape(title), html.escape(desc)
    ui = _UI["de" if lang == "de" else "en"]
    hreflang = ""
    if alt_en and alt_de:
        hreflang = (
            f'<link rel="alternate" hreflang="en" href="{base}{alt_en}">'
            f'<link rel="alternate" hreflang="de" href="{base}{alt_de}">'
            f'<link rel="alternate" hreflang="x-default" href="{base}{alt_en}">'
        )
    ld = "".join(
        f'<script type="application/ld+json">{json.dumps(block, ensure_ascii=False)}</script>'
        for block in (jsonld or [])
    )
    return f"""<!doctype html>
<html lang="{lang}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{t}</title>
<meta name="description" content="{d}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta property="og:type" content="website">
<meta property="og:site_name" content="InkPreview">
<meta property="og:title" content="{t}">
<meta property="og:description" content="{d}">
<meta property="og:image" content="{img}">
<meta property="og:url" content="{url}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{t}">
<meta name="twitter:description" content="{d}">
<meta name="twitter:image" content="{img}">
<link rel="canonical" href="{url}">
{hreflang}
{ld}
<style>
  :root{{color-scheme:dark}}
  *{{box-sizing:border-box}}
  body{{margin:0;background:#07070a;color:#fff;
    font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.6}}
  main{{max-width:680px;margin:0 auto;padding:40px 22px 60px}}
  header.site{{display:flex;justify-content:space-between;align-items:center;
    padding:14px 22px;border-bottom:1px solid rgba(198,255,26,.15)}}
  header.site a{{color:#fff;text-decoration:none;font-weight:800;font-size:14px;
    letter-spacing:.02em}}
  header.site a span{{color:#c6fb50}}
  h1{{font-size:30px;font-weight:800;line-height:1.15;margin:18px 0 10px}}
  h2{{font-size:19px;font-weight:800;margin:38px 0 12px}}
  p{{color:rgba(255,255,255,.6);font-size:15px;margin:0 0 14px}}
  .lead{{font-size:16px;color:rgba(255,255,255,.7)}}
  .eyebrow{{color:rgba(198,255,26,.75);font-size:11px;font-weight:700;
    letter-spacing:.25em;text-transform:uppercase;margin:0}}
  .grid{{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0}}
  .grid a{{display:block;background:#fff;border-radius:14px;overflow:hidden;aspect-ratio:1;
    border:1px solid rgba(255,255,255,.08)}}
  .grid img{{width:100%;height:100%;object-fit:contain;padding:6px}}
  ol{{padding-left:20px;color:rgba(255,255,255,.7);font-size:15px}}
  ol li{{margin-bottom:8px}}
  details{{border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:13px 16px;
    margin-bottom:10px}}
  summary{{font-weight:700;font-size:14.5px;cursor:pointer;color:rgba(255,255,255,.85)}}
  details p{{margin:10px 0 2px;font-size:14px}}
  .mesh{{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}}
  .mesh a{{color:rgba(255,255,255,.65);text-decoration:none;font-size:13px;
    border:1px solid rgba(255,255,255,.14);
    border-radius:999px;padding:6px 13px}}
  .mesh a:hover{{color:#c6fb50;border-color:rgba(198,255,26,.5)}}
  .cta{{display:block;text-align:center;background:#c6fb50;color:#07070a;font-weight:800;
    text-decoration:none;padding:15px 28px;border-radius:999px;margin:34px auto 8px;max-width:330px;
    box-shadow:0 0 42px -10px rgba(198,255,26,.6)}}
  .sub{{text-align:center;color:rgba(255,255,255,.35);font-size:12px}}
  .art{{background:#fff;border-radius:24px;padding:16px;
    border:1px solid rgba(255,255,255,.08);margin:18px 0}}
  .art img{{width:100%;height:auto;display:block;border-radius:12px}}
  footer{{text-align:center;color:rgba(255,255,255,.28);font-size:12px;padding:30px 0 40px}}
</style></head>
<body>
<header class="site"><a href="{base}{"/de" if lang == "de" else "/"}">INK<span>PREVIEW</span> ✦</a>
<a href="{cta_href or (base + ("/de" if lang == "de" else "/"))}"
 style="color:#c6fb50;font-size:13px">{html.escape(cta_label or ui["cta"])}</a></header>
<main>{body}
  <a class="cta"
   href="{cta_href or (base + ("/de" if lang == "de" else "/"))}"
  >{html.escape(cta_label or ui["cta"])}</a>
  <p class="sub">{html.escape(ui["free"])}</p>
</main>
<footer>ink-preview.com</footer>
</body></html>"""


async def _recent_done(session) -> list[Design]:
    rows = await session.execute(
        select(Design)
        .where(Design.status == JobStatus.DONE, Design.clean_png_url.is_not(None))
        .order_by(Design.created_at.desc())
        .limit(60)
    )
    return list(rows.scalars().all())


def _grid(base: str, designs: list[Design], limit: int = 9) -> str:
    items = designs[:limit]
    if not items:
        return ""
    tiles = "".join(
        f'<a href="{base}/d/{d.id}"><img src="{_abs(base, d.thumb_url or d.clean_png_url)}"'
        f' alt="{html.escape((d.prompt or "AI tattoo design")[:80])}" loading="lazy"></a>'
        for d in items
    )
    return f'<div class="grid">{tiles}</div>'


def _first_img(base: str, designs: list[Design]) -> str:
    if designs:
        return _abs(base, designs[0].clean_png_url or designs[0].thumb_url)
    return f"{base}/og.png"


def _faq_html(faq: list[tuple[str, str]], heading: str) -> str:
    items = "".join(
        f"<details><summary>{html.escape(q)}</summary><p>{html.escape(a)}</p></details>"
        for q, a in faq
    )
    return f"<h2>{html.escape(heading)}</h2>{items}"


def _how_html(lang: str) -> str:
    ui = _UI[lang]
    steps = "".join(f"<li>{html.escape(s)}</li>" for s in ui["steps"])
    return f"<h2>{html.escape(ui['how'])}</h2><ol>{steps}</ol>"


def _mesh_html(base: str, lang: str, *, skip_style: str = "", skip_part: str = "") -> str:
    """Cross-link styles ↔ body parts — the internal crawl mesh."""
    ui = _UI[lang]
    prefix = "/de" if lang == "de" else ""
    styles = [r for r in all_recipes() if r.slug != skip_style][:10]
    style_links = "".join(
        f'<a href="{base}{prefix}/style/{r.slug}">{html.escape(r.name)}</a>' for r in styles
    )
    part_links = "".join(
        f'<a href="{base}{prefix}/tattoo/{slug}">'
        f'{html.escape(names[1] if lang == "de" else names[0])}</a>'
        for slug, names in _BODY_PARTS.items()
        if slug != skip_part
    )
    return (
        f"<h2>{html.escape(ui['styles'])}</h2><nav class='mesh'>{style_links}</nav>"
        f"<h2>{html.escape(ui['parts'])}</h2><nav class='mesh'>{part_links}</nav>"
    )


def _not_found(base: str, url: str) -> HTMLResponse:
    return HTMLResponse(
        _page(
            title="Not found | InkPreview",
            desc="AI tattoo designer — see your tattoo on your own skin before the needle.",
            img=f"{base}/og.png",
            url=url,
            base=base,
            body="<h1>Not found</h1><p>This page may have moved.</p>",
        ),
        status_code=404,
    )


@router.get("/d/{design_id}", response_class=HTMLResponse)
async def share_page(
    design_id: str,
    session=Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> HTMLResponse:
    base = settings.frontend_base_url.rstrip("/")
    design = await session.get(Design, design_id)
    if design is None or design.status != JobStatus.DONE or not design.clean_png_url:
        return _not_found(base, f"{base}/d/{design_id}")

    prompt = (design.prompt or "").strip()
    img = _abs(base, design.clean_png_url)
    title = f"InkPreview — {prompt[:60]}" if prompt else "InkPreview — AI tattoo design"
    desc = (
        f"AI tattoo flash: {prompt[:120]}. Preview it on your own skin and export an "
        "artist-ready file — free, no signup."
        if prompt
        else "An AI-generated tattoo design. Make your own in seconds."
    )
    recent = [d for d in await _recent_done(session) if d.id != design.id]
    jsonld = [
        {
            "@context": "https://schema.org",
            "@type": "ImageObject",
            "contentUrl": img,
            "name": title,
            "description": desc,
            "creator": {"@type": "Organization", "name": "InkPreview"},
            "creditText": "InkPreview — AI tattoo designer",
            "license": f"{base}/agb",
        },
        _jsonld_breadcrumbs(
            base,
            [
                ("InkPreview", "/"),
                ("Explore", "/explore"),
                (prompt[:40] or "Design", f"/d/{design.id}"),
            ],
        ),
    ]
    body = (
        f'<p class="eyebrow">✦ AI Tattoo Flash</p>'
        f"<h1>{html.escape(prompt[:80] or 'AI tattoo design')}</h1>"
        f'<div class="art"><img src="{img}" alt="{html.escape(desc[:100])}"></div>'
        f'<p class="lead">{html.escape(desc)}</p>'
        f"<h2>{html.escape(_UI['en']['examples'])}</h2>{_grid(base, recent, 6)}"
        f"{_how_html('en')}"
        f"{_mesh_html(base, 'en')}"
    )
    return HTMLResponse(
        _page(
            title=title,
            desc=desc,
            img=img,
            url=f"{base}/d/{design.id}",
            base=base,
            body=body,
            jsonld=jsonld,
        )
    )


async def _render_style(slug: str, lang: str, session, settings: Settings) -> HTMLResponse:
    base = settings.frontend_base_url.rstrip("/")
    prefix = "/de" if lang == "de" else ""
    recipe = get_recipe(slug)
    if recipe is None:
        return _not_found(base, f"{base}{prefix}/style/{slug}")

    recent = await _recent_done(session)
    examples = [d for d in recent if slug in (d.styles or [])] or recent
    ui = _UI[lang]
    if lang == "de":
        title = f"{recipe.name} Tattoo Designs mit KI erstellen + an dir testen | InkPreview"
        desc = (
            f"{recipe.name}-Tattoos mit KI entwerfen und fotorealistisch auf deiner eigenen "
            "Haut testen. Artist-Datei + Stencil exportieren — kostenlos, ohne Anmeldung."
        )[:155]
        h1 = f"{recipe.name} Tattoos"
        lead = (
            f"{recipe.description} Mit InkPreview entwirfst du {recipe.name}-Designs per KI, "
            "testest sie fotorealistisch an deiner eigenen Haut und nimmst eine druckfertige "
            "Artist-Datei mit ins Studio."
        )
    else:
        title = f"{recipe.name} Tattoos — AI Designs & Skin Preview | InkPreview"
        desc = (
            f"Generate {recipe.name} tattoo designs with AI and preview them photorealistically "
            "on your own skin. Export an artist file + stencil — free, no signup."
        )[:155]
        h1 = f"{recipe.name} tattoos"
        lead = (
            f"{recipe.description} With InkPreview you design {recipe.name} pieces with AI, "
            "preview them photorealistically on your own skin, and walk into the studio with a "
            "print-ready artist file."
        )

    faq = _style_faq(recipe.name, lang)
    crumbs_root = "Stile" if lang == "de" else "Styles"
    jsonld = [
        _jsonld_faq(faq),
        _jsonld_breadcrumbs(
            base,
            [
                ("InkPreview", prefix or "/"),
                (crumbs_root, f"{prefix}/style/{slug}"),
                (recipe.name, f"{prefix}/style/{slug}"),
            ],
        ),
    ]
    body = (
        f'<p class="eyebrow">✦ {html.escape(crumbs_root)}</p>'
        f"<h1>{html.escape(h1)}</h1>"
        f'<p class="lead">{html.escape(lead)}</p>'
        f"<h2>{html.escape(ui['examples'])}</h2>{_grid(base, examples)}"
        f"{_how_html(lang)}"
        f"{_faq_html(faq, ui['faq'])}"
        f"{_mesh_html(base, lang, skip_style=slug)}"
    )
    return HTMLResponse(
        _page(
            title=title,
            desc=desc,
            img=_first_img(base, examples),
            url=f"{base}{prefix}/style/{slug}",
            base=base,
            body=body,
            lang=lang,
            alt_en=f"/style/{slug}",
            alt_de=f"/de/style/{slug}",
            jsonld=jsonld,
        )
    )


async def _render_part(part: str, lang: str, session, settings: Settings) -> HTMLResponse:
    base = settings.frontend_base_url.rstrip("/")
    prefix = "/de" if lang == "de" else ""
    info = _BODY_PARTS.get(part)
    if info is None:
        return _not_found(base, f"{base}{prefix}/tattoo/{part}")
    en_name, de_name, en_intro, de_intro = info
    name = de_name if lang == "de" else en_name
    recent = await _recent_done(session)
    ui = _UI[lang]

    if lang == "de":
        title = f"{name}-Tattoo: Ideen + Vorschau auf deiner Haut | InkPreview"
        desc = (
            f"{name}-Tattoo gesucht? Entwirf Motive mit KI und sieh sie fotorealistisch an "
            f"deinem eigenen {name}, bevor du stichst. Kostenlos testen."
        )[:155]
        h1 = f"{name}-Tattoo: Ideen & Vorschau"
        lead = de_intro
        crumbs_root = "Körperstellen"
    else:
        title = f"{name} Tattoo Ideas — Preview On Your Own Skin | InkPreview"
        desc = (
            f"Looking for a {name.lower()} tattoo? Design with AI and see it photorealistically "
            f"on your own {name.lower()} before you commit. Free to try."
        )[:155]
        h1 = f"{name} tattoo ideas & preview"
        lead = en_intro
        crumbs_root = "Placements"

    faq = _part_faq(name, lang)
    jsonld = [
        _jsonld_faq(faq),
        _jsonld_breadcrumbs(
            base,
            [
                ("InkPreview", prefix or "/"),
                (crumbs_root, f"{prefix}/tattoo/{part}"),
                (name, f"{prefix}/tattoo/{part}"),
            ],
        ),
    ]
    body = (
        f'<p class="eyebrow">✦ {html.escape(crumbs_root)}</p>'
        f"<h1>{html.escape(h1)}</h1>"
        f'<p class="lead">{html.escape(lead)}</p>'
        f"<h2>{html.escape(ui['examples'])}</h2>{_grid(base, recent)}"
        f"{_how_html(lang)}"
        f"{_faq_html(faq, ui['faq'])}"
        f"{_mesh_html(base, lang, skip_part=part)}"
    )
    return HTMLResponse(
        _page(
            title=title,
            desc=desc,
            img=_first_img(base, recent),
            url=f"{base}{prefix}/tattoo/{part}",
            base=base,
            body=body,
            lang=lang,
            alt_en=f"/tattoo/{part}",
            alt_de=f"/de/tattoo/{part}",
            jsonld=jsonld,
        )
    )


@router.get("/style/{slug}", response_class=HTMLResponse)
async def style_page(
    slug: str, session=Depends(get_session), settings: Settings = Depends(get_settings)
) -> HTMLResponse:
    return await _render_style(slug, "en", session, settings)


@router.get("/de/style/{slug}", response_class=HTMLResponse)
async def style_page_de(
    slug: str, session=Depends(get_session), settings: Settings = Depends(get_settings)
) -> HTMLResponse:
    return await _render_style(slug, "de", session, settings)


@router.get("/tattoo/{part}", response_class=HTMLResponse)
async def bodypart_page(
    part: str, session=Depends(get_session), settings: Settings = Depends(get_settings)
) -> HTMLResponse:
    return await _render_part(part, "en", session, settings)


@router.get("/de/tattoo/{part}", response_class=HTMLResponse)
async def bodypart_page_de(
    part: str, session=Depends(get_session), settings: Settings = Depends(get_settings)
) -> HTMLResponse:
    return await _render_part(part, "de", session, settings)


@router.get("/sitemap.xml")
async def sitemap(settings: Settings = Depends(get_settings)) -> Response:
    """Dynamic sitemap — every page, with hreflang pairs for the EN/DE variants."""
    base = settings.frontend_base_url.rstrip("/")

    def _alt(en: str, de: str) -> str:
        return (
            f'<xhtml:link rel="alternate" hreflang="en" href="{base}{en}"/>'
            f'<xhtml:link rel="alternate" hreflang="de" href="{base}{de}"/>'
            f'<xhtml:link rel="alternate" hreflang="x-default" href="{base}{en}"/>'
        )

    def _u(loc: str, priority: str, freq: str = "weekly", alt: str = "") -> str:
        return (
            f"<url><loc>{base}{loc}</loc>{alt}"
            f"<changefreq>{freq}</changefreq><priority>{priority}</priority></url>"
        )

    parts = [
        _u("/", "1.0", alt=_alt("/", "/de")),
        _u("/de", "0.9", alt=_alt("/", "/de")),
        _u("/explore", "0.8", "daily", alt=_alt("/explore", "/de/explore")),
        _u("/de/explore", "0.7", "daily", alt=_alt("/explore", "/de/explore")),
        _u("/pricing", "0.7", alt=_alt("/pricing", "/de/pricing")),
        _u("/de/pricing", "0.6", alt=_alt("/pricing", "/de/pricing")),
        _u("/impressum", "0.3", "yearly"),
        _u("/datenschutz", "0.3", "yearly"),
        _u("/agb", "0.3", "yearly"),
    ]
    for r in all_recipes():
        alt = _alt(f"/style/{r.slug}", f"/de/style/{r.slug}")
        parts.append(_u(f"/style/{r.slug}", "0.6", alt=alt))
        parts.append(_u(f"/de/style/{r.slug}", "0.6", alt=alt))
    for slug in _BODY_PARTS:
        alt = _alt(f"/tattoo/{slug}", f"/de/tattoo/{slug}")
        parts.append(_u(f"/tattoo/{slug}", "0.6", alt=alt))
        parts.append(_u(f"/de/tattoo/{slug}", "0.6", alt=alt))

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
        'xmlns:xhtml="http://www.w3.org/1999/xhtml">'
        + "".join(parts)
        + "</urlset>"
    )
    return Response(content=xml, media_type="application/xml")
