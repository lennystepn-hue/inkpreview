/**
 * Tiny URL-driven i18n. Language is derived from the route prefix (`/de` => German,
 * everything else => English) so each language has its own indexable URL. See
 * {@link useLang} / {@link useT} / {@link useLangPath} in ./useT.ts.
 */

export type Lang = "en" | "de";
export const LANGS: Lang[] = ["en", "de"];

type Entry = { en: string; de: string };

export const dict = {
  "common.retry": { en: "retry", de: "nochmal" },
  "common.download": { en: "download", de: "laden" },
  "common.loading": { en: "loading…", de: "lädt…" },

  "nav.create": { en: "Create", de: "Erstellen" },
  "nav.tryOn": { en: "Try On", de: "Anprobieren" },
  "nav.ink": { en: "Ink", de: "Ink" },
  "nav.langLabel": { en: "Deutsch", de: "English" },

  "session.offline": { en: "offline", de: "offline" },

  "auth.signIn": { en: "Sign in", de: "Anmelden" },
  "auth.signInGoogle": { en: "Sign in with Google", de: "Mit Google anmelden" },
  "auth.signOut": { en: "Sign out", de: "Abmelden" },
  "auth.savePrompt": {
    en: "Sign in to save your designs and see them on any device.",
    de: "Melde dich an, um deine Designs zu speichern und überall zu sehen.",
  },

  "create.srHeading": {
    en: "See your tattoo on your own skin before the needle — AI tattoo designer and simulator",
    de: "Sieh dein Tattoo auf deiner eigenen Haut, bevor die Nadel kommt — KI-Tattoo-Designer und -Simulator",
  },
  "create.hero.titlePre": { en: "Conjure your ", de: "Beschwör dein " },
  "create.hero.titleGlow": { en: "Tattoo", de: "Tattoo" },
  "create.hero.titlePost": { en: ".", de: "." },
  "create.hero.tagline": {
    en: "Describe it. The AI inks it. See it on your skin.",
    de: "Beschreib es. Die KI sticht es. Sieh es auf deiner Haut.",
  },
  "create.prompt.placeholder": {
    en: "e.g. a wolf, fine-line, minimal, geometric…",
    de: "z. B. ein Wolf, Fine-Line, minimal, geometrisch…",
  },
  "create.enhance": { en: "✨ Enhance", de: "✨ Aufpolieren" },
  "create.enhance.loading": { en: "✨ …", de: "✨ …" },
  "create.magic": { en: "🎲 I'm feeling magic", de: "🎲 Überrasch mich" },
  "create.style.label": { en: "Style", de: "Stil" },
  "create.style.pick": { en: "+ pick", de: "+ wählen" },
  "create.style.empty": { en: "no style yet — optional", de: "noch kein Stil — optional" },
  "create.color.on": { en: "Color", de: "Farbe" },
  "create.color.off": { en: "Black & Grey", de: "Schwarz-Grau" },
  "create.submit": { en: "Conjure design ✦", de: "Design beschwören ✦" },
  "create.gallery.label": {
    en: "Fresh ink — conjured by the machine ✦",
    de: "Fresh ink — beschworen von der Maschine ✦",
  },

  "result.tryOn": { en: "Try on skin ✦", de: "Auf Haut testen ✦" },
  "result.variants": { en: "Variants", de: "Varianten" },
  "result.variants.loading": { en: "conjuring…", de: "beschwört…" },
  "result.newDesign": { en: "↺ conjure a new design", de: "↺ neues Design beschwören" },
  "result.refine.placeholder": {
    en: "Adjust it — add a detail, change the style…",
    de: "Pass es an — Detail ergänzen, Stil ändern…",
  },
  "result.refine.button": { en: "Adjust ✦", de: "Anpassen ✦" },
  "result.refine.label": { en: "refining your design", de: "passt dein Design an" },

  "styleSheet.title": { en: "Pick a style", de: "Stil wählen" },
  "styleSheet.done": { en: "Done · {count} selected", de: "Fertig · {count} gewählt" },

  "studio.empty.title": { en: "A design first", de: "Erst ein Design" },
  "studio.empty.body": {
    en: "Conjure a tattoo first — then we'll place it on your photo.",
    de: "Beschwör erst ein Tattoo — dann platzieren wir es auf deinem Foto.",
  },
  "studio.empty.cta": { en: "To the generator", de: "Zum Generator" },
  "studio.placing.label": { en: "placing it on your skin", de: "platziert es auf deiner Haut" },
  "studio.header.title": { en: "On your skin", de: "Auf deiner Haut" },
  "studio.header.body": {
    en: "Upload a photo, tap the spot, set size + rotation freely — the AI places it.",
    de: "Foto hochladen, Stelle antippen, Größe + Drehung frei wählen — die KI platziert es.",
  },
  "studio.upload.cta": { en: "Take / choose a photo", de: "Foto machen / wählen" },
  "studio.upload.hint": { en: "Arm, calf, back … stored only briefly", de: "Arm, Wade, Rücken … nur kurz gespeichert" },
  "studio.preview.disclaimer": {
    en: "Preview ≠ final tattoo — your studio adapts the design.",
    de: "Vorschau ≠ fertiges Tattoo — dein Studio passt das Design an.",
  },
  "studio.export": { en: "Export ✦", de: "Export ✦" },
  "studio.placeAgain": { en: "place again", de: "neu platzieren" },
  "studio.tapHint": { en: "tap where the tattoo should sit", de: "tippe, wo das Tattoo sitzen soll" },
  "studio.size": { en: "Size", de: "Größe" },
  "studio.rotation": { en: "Rotation", de: "Drehung" },
  "studio.place": { en: "Place on skin ✦", de: "Auf Haut platzieren ✦" },
  "studio.differentPhoto": { en: "↺ different photo", de: "↺ anderes Foto" },

  "qr.title": { en: "Scan with your phone", de: "Mit dem Handy scannen" },
  "qr.body": {
    en: "Point your phone camera at this, snap the body part, and it shows up here automatically.",
    de: "Richte deine Handykamera drauf, knips die Körperstelle, und es taucht hier automatisch auf.",
  },

  "capture.done.title": { en: "Sent ✦", de: "Gesendet ✦" },
  "capture.done.body": {
    en: "Switch back to your computer — your photo is already there.",
    de: "Wechsel zurück an deinen Computer — dein Foto ist schon da.",
  },
  "capture.title": { en: "Snap the body part", de: "Körperstelle knipsen" },
  "capture.body": {
    en: "Take a photo of where you want the tattoo — it appears on your computer automatically.",
    de: "Mach ein Foto, wo du das Tattoo willst — es erscheint automatisch auf deinem Computer.",
  },
  "capture.camera": { en: "Camera", de: "Kamera" },
  "capture.errorSuffix": { en: "— this link may have expired.", de: "— dieser Link ist vielleicht abgelaufen." },
  "capture.privacy": {
    en: "Photos are stored briefly and auto-deleted.",
    de: "Fotos werden nur kurz gespeichert und automatisch gelöscht.",
  },

  "gallery.title": { en: "Your Ink", de: "Dein Ink" },
  "gallery.subtitle": { en: "Tap a design to try it on your skin.", de: "Tippe ein Design an, um es auf deiner Haut zu testen." },
  "gallery.empty": { en: "Empty for now — time for your first design ✦", de: "Noch leer — Zeit für dein erstes Design ✦" },

  "export.title": { en: "Done ✦", de: "Fertig ✦" },
  "export.subtitle": {
    en: "Download the clean design file + your mockup and send both to your studio.",
    de: "Lad die saubere Design-Datei + dein Mockup runter und schick beides an dein Studio.",
  },
  "export.preparing": { en: "preparing export…", de: "Export wird vorbereitet…" },
  "export.asset.cleanDesign": { en: "Clean Design (Artist-ready)", de: "Sauberes Design (artist-ready)" },
  "export.asset.bodyMockup": { en: "Body Mockup", de: "Body-Mockup" },
  "export.share": { en: "Share", de: "Teilen" },
  "export.shareText": { en: "my next tattoo, made with InkPreview ✦", de: "mein nächstes Tattoo, gemacht mit InkPreview ✦" },
  "export.watermark.notice": {
    en: "Free export = watermarked & reduced resolution. Upgrade for the clean, hi-res artist file (credits coming soon).",
    de: "Gratis-Export = mit Wasserzeichen & reduzierter Auflösung. Upgrade für die saubere Hi-Res-Artist-Datei (Credits kommen bald).",
  },
  "export.preview.disclaimer": {
    en: "Preview ≠ final tattoo — your studio adapts the design.",
    de: "Vorschau ≠ fertiges Tattoo — dein Studio passt das Design an.",
  },
  "export.newDesign": { en: "↺ conjure a new design", de: "↺ neues Design beschwören" },

  "ritual.default": { en: "conjuring your design", de: "beschwört dein Design" },
  "ritual.footer": { en: "the needle awaits ✦", de: "die Nadel wartet ✦" },

  "errors.uploadFailed": { en: "Upload failed", de: "Upload fehlgeschlagen" },
  "errors.generation.timeout": {
    en: "Still conjuring — that took unusually long. Give it another go.",
    de: "Beschwört noch — das dauerte ungewöhnlich lang. Probier's nochmal.",
  },
  "errors.composite.timeout": {
    en: "Still placing — that took unusually long. Give it another go.",
    de: "Platziert noch — das dauerte ungewöhnlich lang. Probier's nochmal.",
  },
} satisfies Record<string, Entry>;

export type DictKey = keyof typeof dict;

export function t(key: DictKey, lang: Lang, vars?: Record<string, string | number>): string {
  let s: string = dict[key]?.[lang] ?? dict[key]?.en ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  }
  return s;
}

/** Non-React translation (e.g. inside hooks that already know the lang). */
export const translate = t;
