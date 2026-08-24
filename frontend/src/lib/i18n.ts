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
  "nav.explore": { en: "Explore", de: "Entdecken" },
  "nav.tryOn": { en: "Try On", de: "Anprobieren" },
  "nav.ink": { en: "Ink", de: "Ink" },
  "nav.account": { en: "Account", de: "Konto" },
  "nav.pricing": { en: "Pricing", de: "Preise" },
  "account.settings": { en: "Account settings", de: "Konto-Einstellungen" },
  "pricing.title": { en: "Plans & pricing", de: "Pläne & Preise" },
  "pricing.subtitle": {
    en: "Start free. Upgrade whenever you're ready.",
    de: "Kostenlos starten. Upgrade wann du willst.",
  },
  "pricing.recommended": { en: "Most popular", de: "Beliebt" },
  "pricing.free.name": { en: "Free", de: "Kostenlos" },
  "pricing.free.price": { en: "€0", de: "0 €" },
  "pricing.free.f1": {
    en: "2 designs as guest · 10/month signed in",
    de: "2 Designs als Gast · 10/Monat angemeldet",
  },
  "pricing.free.f2": { en: "Try designs on your skin", de: "Designs auf der Haut anprobieren" },
  "pricing.free.f3": { en: "Export with watermark", de: "Export mit Wasserzeichen" },
  "pricing.pro.name": { en: "Pro", de: "Pro" },
  "pricing.pro.price": { en: "€9.99/mo", de: "9,99 €/Mon." },
  "pricing.pro.f1": { en: "Unlimited generations", de: "Unbegrenzte Generierungen" },
  "pricing.pro.f2": {
    en: "Clean hi-res exports, no watermark",
    de: "Saubere Hi-Res-Exporte ohne Wasserzeichen",
  },
  "pricing.pro.f3": { en: "Save your on-skin mockups", de: "On-Skin-Mockups speichern" },
  "pricing.pro.f4": { en: "Variants & refine", de: "Varianten & Verfeinern" },
  "pricing.studio.name": { en: "Studio", de: "Studio" },
  "pricing.studio.price": { en: "Custom", de: "Individuell" },
  "pricing.studio.f1": { en: "Everything in Pro", de: "Alles aus Pro" },
  "pricing.studio.f2": { en: "Your brand on exports", de: "Eigenes Branding auf Exporten" },
  "pricing.studio.f3": { en: "Pooled credits (soon)", de: "Geteilte Credits (bald)" },
  "pricing.studio.f4": { en: "Priority support", de: "Priorisierter Support" },
  "pricing.cta.current": { en: "Your plan", de: "Dein Plan" },
  "pricing.cta.pro": { en: "Upgrade to Pro ✦", de: "Auf Pro upgraden ✦" },
  "pricing.cta.signin": { en: "Sign in to upgrade", de: "Anmelden zum Upgraden" },
  "pricing.cta.studio": { en: "Contact us", de: "Kontaktiere uns" },
  "pricing.cta.soon": { en: "Coming soon", de: "Bald verfügbar" },
  "account.title": { en: "Your account", de: "Dein Konto" },
  "account.guest": { en: "Guest", de: "Gast" },
  "account.plan.free": { en: "Free", de: "Kostenlos" },
  "account.plan.pro": { en: "Pro", de: "Pro" },
  "account.plan.studio": { en: "Studio", de: "Studio" },
  "account.quota.title": { en: "Generations", de: "Generierungen" },
  "account.quota.unlimited": { en: "Unlimited ✦", de: "Unbegrenzt ✦" },
  "account.quota.used": { en: "{used} of {limit} used", de: "{used} von {limit} genutzt" },
  "account.signIn.title": { en: "Not signed in", de: "Nicht angemeldet" },
  "account.signIn.body": {
    en: "Sign in to save your designs, manage billing and unlock Pro.",
    de: "Melde dich an, um Designs zu speichern, dein Abo zu verwalten und Pro freizuschalten.",
  },
  "account.signIn.cta": { en: "Sign in with Google", de: "Mit Google anmelden" },
  "account.upgrade.title": { en: "Go unlimited with Pro", de: "Unbegrenzt mit Pro" },
  "account.upgrade.body": {
    en: "Unlimited designs, clean hi-res exports without watermark, and more.",
    de: "Unbegrenzte Designs, saubere Hi-Res-Exporte ohne Wasserzeichen und mehr.",
  },
  "account.referral.title": { en: "Refer a friend", de: "Freund einladen" },
  "account.referral.body": {
    en: "Share your link — you both get +1 design.",
    de: "Teile deinen Link — ihr bekommt beide +1 Design.",
  },
  "account.referral.copied": { en: "Invite link copied ✓", de: "Einladungslink kopiert ✓" },
  "account.gdpr.title": { en: "Your data", de: "Deine Daten" },
  "nav.langLabel": { en: "Deutsch", de: "English" },

  "session.offline": { en: "offline", de: "offline" },

  "footer.impressum": { en: "Legal notice", de: "Impressum" },
  "footer.privacy": { en: "Privacy", de: "Datenschutz" },
  "footer.terms": { en: "Terms", de: "AGB" },
  "footer.cookies": { en: "Cookie settings", de: "Cookie-Einstellungen" },
  "footer.tagline": { en: "see it before you ink it", de: "erst sehen, dann stechen" },

  "consent.text": {
    en: "We use analytics cookies only with your consent to improve InkPreview. Essential functions always run.",
    de: "Wir nutzen Analyse-Cookies nur mit deiner Einwilligung, um InkPreview zu verbessern. Notwendige Funktionen laufen immer.",
  },
  "consent.accept": { en: "Accept", de: "Akzeptieren" },
  "consent.reject": { en: "Reject", de: "Ablehnen" },
  "consent.learn": { en: "Privacy", de: "Datenschutz" },

  "auth.signIn": { en: "Sign in", de: "Anmelden" },
  "auth.signInGoogle": { en: "Sign in with Google", de: "Mit Google anmelden" },
  "auth.signOut": { en: "Sign out", de: "Abmelden" },
  "billing.upgrade": { en: "Upgrade to Pro ✦", de: "Auf Pro upgraden ✦" },
  "billing.manage": { en: "Manage subscription", de: "Abo verwalten" },
  "billing.pro": { en: "Pro", de: "Pro" },
  "billing.studio": { en: "Studio", de: "Studio" },
  "common.save": { en: "Save", de: "Speichern" },
  "studio.brand.label": { en: "Studio brand (on exports)", de: "Studio-Marke (auf Exporten)" },
  "studio.brand.placeholder": { en: "Your studio name", de: "Dein Studioname" },
  "upgrade.title": { en: "InkPreview Pro", de: "InkPreview Pro" },
  "upgrade.subtitle": {
    en: "Unlimited generations and clean, watermark-free exports.",
    de: "Unbegrenzt generieren und saubere Exporte ohne Wasserzeichen.",
  },
  "upgrade.b1": { en: "Unlimited generations", de: "Unbegrenzte Generierungen" },
  "upgrade.b2": { en: "Clean hi-res file, no watermark", de: "Saubere Hi-Res-Datei ohne Wasserzeichen" },
  "upgrade.b3": { en: "Save your on-skin mockups", de: "On-Skin-Mockups speichern" },
  "upgrade.price": { en: "€9.99 / month", de: "9,99 € / Monat" },
  "upgrade.waiver": {
    en: "I expressly request immediate access and confirm that I lose my right of withdrawal once the service begins.",
    de: "Ich verlange ausdrücklich den sofortigen Leistungsbeginn und bestätige, dass ich mit Vertragsbeginn mein Widerrufsrecht verliere.",
  },
  "upgrade.cta": { en: "Continue to payment", de: "Weiter zur Zahlung" },
  "upgrade.error": { en: "Couldn't start checkout — please try again.", de: "Zahlung konnte nicht gestartet werden — bitte erneut versuchen." },
  "common.cancel": { en: "Cancel", de: "Abbrechen" },
  "account.invite": { en: "Invite friends · +1 design each", de: "Freunde einladen · +1 Design pro Person" },
  "account.invite.copied": { en: "Invite link copied ✓", de: "Einladungslink kopiert ✓" },
  "account.export": { en: "Export data", de: "Daten exportieren" },
  "account.delete": { en: "Delete account", de: "Konto löschen" },
  "account.delete.confirm": {
    en: "Delete your account and all your data? This can't be undone.",
    de: "Konto und alle Daten löschen? Das kann nicht rückgängig gemacht werden.",
  },
  "quota.promo": {
    en: "Launch preview — unlimited, only for a few days",
    de: "Launch-Preview — unbegrenzt, nur noch wenige Tage",
  },
  "quota.promoNote": {
    en: "Free unlimited during the launch preview — lock it in with Pro later.",
    de: "Während der Launch-Preview gratis unbegrenzt — sichere es dir später mit Pro.",
  },
  "quota.guest": { en: "{left}/{limit} free designs left", de: "Noch {left}/{limit} Gratis-Designs" },
  "quota.month": { en: "{left}/{limit} left this month", de: "Noch {left}/{limit} diesen Monat" },
  "paywall.guest.title": { en: "Out of free designs", de: "Gratis-Designs aufgebraucht" },
  "paywall.guest.body": {
    en: "Sign in free to get 10 designs every month.",
    de: "Melde dich kostenlos an und hol dir 10 Designs pro Monat.",
  },
  "paywall.guest.cta": { en: "Sign in free", de: "Kostenlos anmelden" },
  "paywall.free.title": { en: "Monthly limit reached", de: "Monatslimit erreicht" },
  "paywall.free.body": {
    en: "Go Pro for unlimited designs.",
    de: "Mit Pro generierst du unbegrenzt.",
  },
  "paywall.free.resets": { en: "Resets at the start of next month.", de: "Setzt sich nächsten Monat zurück." },
  "auth.savePrompt": {
    en: "Sign in to save your designs and see them on any device.",
    de: "Melde dich an, um deine Designs zu speichern und überall zu sehen.",
  },

  "create.srHeading": {
    en: "See your tattoo on your own skin before the needle — AI tattoo designer and simulator",
    de: "Sieh dein Tattoo auf deiner eigenen Haut, bevor die Nadel kommt — KI-Tattoo-Designer und -Simulator",
  },
  "create.hero.eyebrow": { en: "AI Tattoo Studio", de: "KI-Tattoo-Studio" },
  "create.prompt.label": { en: "Your idea", de: "Deine Idee" },
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
  "create.detail.label": { en: "Detail", de: "Detailgrad" },
  "create.detail.minimal": { en: "Minimal", de: "Minimal" },
  "create.detail.balanced": { en: "Balanced", de: "Mittel" },
  "create.detail.detailed": { en: "Detailed", de: "Detailliert" },
  "create.lines.label": { en: "Lines", de: "Linien" },
  "create.lines.fine": { en: "Fine", de: "Fein" },
  "create.lines.medium": { en: "Medium", de: "Mittel" },
  "create.lines.bold": { en: "Bold", de: "Kräftig" },
  "create.submit": { en: "Conjure design ✦", de: "Design beschwören ✦" },
  "create.gallery.label": {
    en: "Fresh ink — conjured by the machine ✦",
    de: "Fresh ink — beschworen von der Maschine ✦",
  },

  "result.tryOn": { en: "Try on skin ✦", de: "Auf Haut testen ✦" },
  "result.artistNote": {
    en: "Flash card ready — take it to your artist",
    de: "Flash-Card fertig — nimm sie mit zu deinem Artist",
  },
  "result.variants": { en: "Variants", de: "Varianten" },
  "result.variants.loading": { en: "conjuring…", de: "beschwört…" },
  "result.newDesign": { en: "↺ conjure a new design", de: "↺ neues Design beschwören" },
  "result.share": { en: "↗ Share design", de: "↗ Design teilen" },
  "result.share.copied": { en: "Link copied ✓", de: "Link kopiert ✓" },
  "explore.eyebrow": { en: "Community Flash", de: "Community Flash" },
  "explore.title": { en: "Explore AI tattoo designs", de: "KI-Tattoo-Designs entdecken" },
  "explore.subtitle": {
    en: "Fresh ink conjured by the community — tap any to view.",
    de: "Frische Designs aus der Community — tippe für die Ansicht.",
  },
  "explore.empty": { en: "No designs yet — be the first.", de: "Noch keine Designs — sei der erste." },
  "explore.alt": { en: "AI-generated tattoo design", de: "KI-generiertes Tattoo-Design" },
  "explore.cta": { en: "Create your own ✦", de: "Eigenes erstellen ✦" },
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
  "studio.eyebrow": { en: "Try-on Studio", de: "Anprobe-Studio" },
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
  "studio.tapHint": {
    en: "drag to move · pinch to resize & rotate",
    de: "ziehen zum Verschieben · pinch zum Skalieren & Drehen",
  },
  "studio.camera.cta": { en: "Use live camera", de: "Live-Kamera nutzen" },
  "studio.camera.hint": {
    en: "Position the design, then snap",
    de: "Design positionieren, dann auslösen",
  },
  "studio.camera.capture": { en: "Capture", de: "Auslösen" },
  "studio.camera.error": {
    en: "Camera unavailable. Check permissions or upload a photo instead.",
    de: "Kamera nicht verfügbar. Berechtigungen prüfen oder ein Foto hochladen.",
  },
  "studio.size": { en: "Size", de: "Größe" },
  "studio.rotation": { en: "Rotation", de: "Drehung" },
  "studio.place": { en: "Place on skin ✦", de: "Auf Haut platzieren ✦" },
  "studio.differentPhoto": { en: "↺ different photo", de: "↺ anderes Foto" },

  "qr.title": { en: "Scan with your phone", de: "Mit dem Handy scannen" },
  "qr.waiting": { en: "waiting for your phone…", de: "wartet auf dein Handy…" },
  "studio.done.banner": { en: "ready to ink", de: "ready to ink" },
  "qr.body": {
    en: "Point your phone camera at this, snap the body part, and it shows up here automatically.",
    de: "Richte deine Handykamera drauf, knips die Körperstelle, und es taucht hier automatisch auf.",
  },

  "capture.done.title": { en: "Boom — sent! ✦", de: "Boom — gesendet! ✦" },
  "capture.done.body": {
    en: "Switch back to your computer — your tattoo preview is already rendering there.",
    de: "Wechsel zurück an deinen Computer — deine Tattoo-Vorschau rendert dort schon.",
  },
  "capture.title": { en: "Snap the body part", de: "Körperstelle knipsen" },
  "capture.body": {
    en: "Take a photo of where you want the tattoo — it appears on your computer automatically.",
    de: "Mach ein Foto, wo du das Tattoo willst — es erscheint automatisch auf deinem Computer.",
  },
  "capture.camera": { en: "Camera", de: "Kamera" },
  "capture.live": { en: "Live preview", de: "Live-Vorschau" },
  "capture.uploadInstead": { en: "or upload a photo", de: "oder Foto hochladen" },
  "capture.errorSuffix": { en: "— this link may have expired.", de: "— dieser Link ist vielleicht abgelaufen." },
  "capture.privacy": {
    en: "Photos are stored briefly and auto-deleted.",
    de: "Fotos werden nur kurz gespeichert und automatisch gelöscht.",
  },

  "gallery.eyebrow": { en: "Your Collection", de: "Deine Sammlung" },
  "gallery.mockups.badge": { en: "On Skin", de: "Auf der Haut" },
  "gallery.title": { en: "Your Ink", de: "Dein Ink" },
  "gallery.subtitle": { en: "Tap a design to try it on your skin.", de: "Tippe ein Design an, um es auf deiner Haut zu testen." },
  "gallery.empty": { en: "Empty for now — time for your first design ✦", de: "Noch leer — Zeit für dein erstes Design ✦" },

  "export.eyebrow": { en: "Ready to ink", de: "Ready to ink" },
  "export.asset.badge": { en: "Artist file", de: "Artist-Datei" },
  "export.asset.stencil": { en: "Stencil", de: "Stencil" },
  "export.asset.stencilBadge": { en: "Stencil-ready", de: "Stencil-ready" },
  "export.specs": { en: "PNG · 2048 px · 300 DPI", de: "PNG · 2048 px · 300 DPI" },
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
  "export.unlock.title": {
    en: "Watermarked free version",
    de: "Gratis-Version mit Wasserzeichen",
  },
  "export.unlock.body": {
    en: "Pro unlocks the print-ready artist file: 2048 px · 300 DPI PNG + stencil, no watermark.",
    de: "Pro schaltet die druckfertige Artist-Datei frei: 2048 px · 300 DPI PNG + Stencil, ohne Wasserzeichen.",
  },
  "export.unlock.signin": { en: "Sign in to go Pro", de: "Anmelden für Pro" },
  "export.saveMockup": { en: "Save to my account", de: "In meinem Konto speichern" },
  "export.saveMockup.saved": { en: "Saved ✓", de: "Gespeichert ✓" },
  "gallery.mockups.title": { en: "Saved mockups", de: "Gespeicherte Mockups" },
  "compare.title": { en: "{n} versions", de: "{n} Versionen" },
  "compare.pick": { en: "Try this on", de: "Diese anprobieren" },
  "notfound.title": { en: "Page not found", de: "Seite nicht gefunden" },
  "notfound.body": {
    en: "This page may have moved or expired.",
    de: "Diese Seite gibt es nicht mehr oder sie ist abgelaufen.",
  },
  "notfound.cta": { en: "Back to InkPreview", de: "Zurück zu InkPreview" },
  "common.remove": { en: "Remove", de: "Entfernen" },
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
  "errors.moderation": {
    en: "Content safety blocked this. Try a different prompt or a less revealing photo.",
    de: "Von der Inhaltssicherung blockiert. Versuch einen anderen Prompt oder ein dezenteres Foto.",
  },
  "errors.quota.guest": {
    en: "You've used your free designs. Sign in to keep creating.",
    de: "Deine Gratis-Designs sind aufgebraucht. Melde dich an, um weiterzumachen.",
  },
  "errors.quota.month": {
    en: "Monthly limit reached — it resets at the start of next month, or go Pro.",
    de: "Monatslimit erreicht — es setzt sich nächsten Monat zurück, oder hol dir Pro.",
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
