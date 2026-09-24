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
  "pricing.cta.pro": { en: "Upgrade to Pro", de: "Auf Pro upgraden" },
  "pricing.cta.signin": { en: "Sign in to upgrade", de: "Anmelden zum Upgraden" },
  "pricing.cta.studio": { en: "Contact us", de: "Kontaktiere uns" },
  "pricing.cta.soon": { en: "Coming soon", de: "Bald verfügbar" },
  "account.title": { en: "Your account", de: "Dein Konto" },
  "account.guest": { en: "Guest", de: "Gast" },
  "account.plan.free": { en: "Free", de: "Kostenlos" },
  "account.plan.pro": { en: "Pro", de: "Pro" },
  "account.plan.studio": { en: "Studio", de: "Studio" },
  "account.quota.title": { en: "Generations", de: "Generierungen" },
  "account.quota.unlimited": { en: "Unlimited", de: "Unbegrenzt" },
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
  "account.referral.copied": { en: "Invite link copied", de: "Einladungslink kopiert" },
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
  "billing.upgrade": { en: "Upgrade to Pro", de: "Auf Pro upgraden" },
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
  "upgrade.b2": {
    en: "Clean hi-res file, no watermark",
    de: "Saubere Hi-Res-Datei ohne Wasserzeichen",
  },
  "upgrade.b3": { en: "Save your on-skin mockups", de: "On-Skin-Mockups speichern" },
  "upgrade.price": { en: "€9.99 / month", de: "9,99 € / Monat" },
  "upgrade.waiver": {
    en: "I expressly request immediate access and confirm that I lose my right of withdrawal once the service begins.",
    de: "Ich verlange ausdrücklich den sofortigen Leistungsbeginn und bestätige, dass ich mit Vertragsbeginn mein Widerrufsrecht verliere.",
  },
  "upgrade.cta": { en: "Continue to payment", de: "Weiter zur Zahlung" },
  "upgrade.error": {
    en: "Couldn't start checkout — please try again.",
    de: "Zahlung konnte nicht gestartet werden — bitte erneut versuchen.",
  },
  "common.cancel": { en: "Cancel", de: "Abbrechen" },
  "account.invite": {
    en: "Invite friends · +1 design each",
    de: "Freunde einladen · +1 Design pro Person",
  },
  "account.invite.copied": { en: "Invite link copied", de: "Einladungslink kopiert" },
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
  "quota.guest": {
    en: "{left}/{limit} free designs left",
    de: "Noch {left}/{limit} Gratis-Designs",
  },
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
  "paywall.free.resets": {
    en: "Resets at the start of next month.",
    de: "Setzt sich nächsten Monat zurück.",
  },
  "auth.savePrompt": {
    en: "Sign in to save your designs and see them on any device.",
    de: "Melde dich an, um deine Designs zu speichern und überall zu sehen.",
  },

  "create.srHeading": {
    en: "See your tattoo on your own skin before the needle — AI tattoo designer and simulator",
    de: "Sieh dein Tattoo auf deiner eigenen Haut, bevor die Nadel kommt — KI-Tattoo-Designer und -Simulator",
  },
  "create.hero.eyebrow": {
    en: "AI Tattoo Studio · Walk-ins welcome",
    de: "KI-Tattoo-Studio · Walk-ins willkommen",
  },
  "create.prompt.label": { en: "Your idea", de: "Deine Idee" },
  "create.hero.titlePre": { en: "See it on your skin", de: "Sieh es auf deiner Haut" },
  "create.hero.titleGlow": { en: "before the needle", de: "vor der Nadel" },
  "create.hero.titlePost": { en: ".", de: "." },
  "create.hero.tagline": {
    en: "Describe your idea. Get artist-ready flash. Try it on your own skin.",
    de: "Idee beschreiben. Artist-fertiges Flash bekommen. Auf deiner Haut anprobieren.",
  },
  "create.prompt.placeholder": {
    en: "e.g. a moth with moon phases, fine line, palm-sized…",
    de: "z. B. eine Motte mit Mondphasen, Fine Line, handtellergroß…",
  },
  "create.enhance": { en: "Enhance", de: "Aufpolieren" },
  "create.enhance.loading": { en: "Enhancing…", de: "Poliert…" },
  "create.magic": { en: "I'm feeling magic", de: "Überrasch mich" },
  "create.style.label": { en: "Style", de: "Stil" },
  "create.style.pick": { en: "Add style", de: "Stil wählen" },
  "create.style.empty": { en: "Any style — optional", de: "Beliebiger Stil — optional" },
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
  "create.submit": { en: "Conjure design", de: "Design beschwören" },
  "create.gallery.label": { en: "Fresh off the needle", de: "Frisch gestochen" },

  "result.tryOn": { en: "Try on skin", de: "Auf der Haut testen" },
  "result.artistNote": {
    en: "Flash card ready — take it to your artist",
    de: "Flash-Card fertig — nimm sie mit zu deinem Artist",
  },
  "result.variants": { en: "Variants", de: "Varianten" },
  "result.variants.loading": { en: "Drawing…", de: "Zeichnet…" },
  "result.newDesign": { en: "New design", de: "Neues Design" },
  "result.share": { en: "Share", de: "Teilen" },
  "result.share.copied": { en: "Link copied", de: "Link kopiert" },
  "explore.eyebrow": { en: "Community Flash", de: "Community Flash" },
  "explore.title": { en: "Explore AI tattoo designs", de: "KI-Tattoo-Designs entdecken" },
  "explore.subtitle": {
    en: "Straight off the community's drawing table — tap any flash for a closer look.",
    de: "Frisch vom Zeichentisch der Community — tipp ein Flash an, um es genauer anzusehen.",
  },
  "explore.empty": {
    en: "The wall is still empty — pin the first flash.",
    de: "Die Wand ist noch leer — häng das erste Flash auf.",
  },
  "explore.alt": { en: "AI-generated tattoo design", de: "KI-generiertes Tattoo-Design" },
  "explore.cta": { en: "Create your own", de: "Eigenes erstellen" },
  "result.refine.placeholder": {
    en: "add a detail, change the style…",
    de: "Detail ergänzen, Stil ändern…",
  },
  "result.refine.button": { en: "Adjust", de: "Anpassen" },

  "styleSheet.title": { en: "Pick a style", de: "Stil wählen" },
  "styleSheet.done": { en: "Done · {count} selected", de: "Fertig · {count} gewählt" },

  "studio.empty.title": { en: "No flash on the table yet", de: "Noch kein Flash auf dem Tisch" },
  "studio.empty.body": {
    en: "Draw your flash first — then it goes onto your photo as a stencil.",
    de: "Lass zuerst dein Flash zeichnen — dann kommt es als Schablone auf dein Foto.",
  },
  "studio.empty.cta": { en: "Draw a flash", de: "Flash zeichnen" },
  "studio.eyebrow": { en: "Try-on Studio", de: "Anprobe-Studio" },
  "studio.header.title": { en: "On your skin", de: "Auf deiner Haut" },
  "studio.header.body": {
    en: "Snap the spot, place the stencil, set size and angle — the AI inks it onto your photo.",
    de: "Knips die Stelle, setz die Schablone, wähl Größe und Winkel — die KI sticht es auf dein Foto.",
  },
  "studio.upload.cta": { en: "Snap or pick a photo", de: "Foto knipsen oder wählen" },
  "studio.upload.hint": {
    en: "Forearm, calf, back … auto-deleted after 24 h",
    de: "Unterarm, Wade, Rücken … nach 24 h automatisch gelöscht",
  },
  "studio.preview.disclaimer": {
    en: "Preview ≠ final tattoo — your studio adapts the design.",
    de: "Vorschau ≠ fertiges Tattoo — dein Studio passt das Design an.",
  },
  "studio.export": { en: "Export files", de: "Dateien exportieren" },
  "studio.placeAgain": { en: "Place again", de: "Neu platzieren" },
  "studio.tapHint": {
    en: "Drag to move · pinch to resize & turn",
    de: "Ziehen zum Verschieben · Pinch zum Skalieren & Drehen",
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
  "studio.place": { en: "Place on skin", de: "Auf die Haut setzen" },
  "studio.differentPhoto": { en: "Different photo", de: "Anderes Foto" },

  "qr.title": { en: "Scan with your phone", de: "Mit dem Handy scannen" },
  "qr.waiting": { en: "waiting for your phone…", de: "wartet auf dein Handy…" },
  "studio.done.banner": { en: "ready to ink", de: "ready to ink" },
  "qr.body": {
    en: "Point your phone camera at this, snap the body part, and it shows up here automatically.",
    de: "Richte deine Handykamera drauf, knips die Körperstelle, und es taucht hier automatisch auf.",
  },

  "capture.done.title": { en: "Sent!", de: "Gesendet!" },
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
  "capture.errorSuffix": {
    en: "— this link may have expired.",
    de: "— dieser Link ist vielleicht abgelaufen.",
  },
  "capture.privacy": {
    en: "Photos are stored briefly and auto-deleted.",
    de: "Fotos werden nur kurz gespeichert und automatisch gelöscht.",
  },

  "gallery.eyebrow": { en: "Your flash book", de: "Dein Flash-Buch" },
  "gallery.mockups.badge": { en: "On skin", de: "Auf der Haut" },
  "gallery.title": { en: "Your Ink", de: "Dein Ink" },
  "gallery.subtitle": {
    en: "Tap a design to try it on your skin.",
    de: "Tippe ein Design an, um es auf deiner Haut zu testen.",
  },
  "gallery.empty": {
    en: "Your flash book is empty — time to draw your first piece.",
    de: "Dein Flash-Buch ist noch leer — Zeit für dein erstes Motiv.",
  },

  "export.eyebrow": { en: "Ready to ink", de: "Ready to ink" },
  "export.asset.badge": { en: "Artist file", de: "Artist-Datei" },
  "export.asset.stencil": { en: "Stencil", de: "Stencil" },
  "export.asset.stencilBadge": { en: "Stencil-ready", de: "Stencil-ready" },
  "export.specs": { en: "PNG · 2048 px · 300 DPI", de: "PNG · 2048 px · 300 DPI" },
  "export.title": { en: "Ready for the studio", de: "Bereit fürs Studio" },
  "export.subtitle": {
    en: "Download the clean design file + your mockup and send both to your studio.",
    de: "Lad die saubere Design-Datei + dein Mockup runter und schick beides an dein Studio.",
  },
  "export.preparing": {
    en: "Printing your artist ticket…",
    de: "Dein Artist-Ticket wird gedruckt…",
  },
  "export.asset.cleanDesign": { en: "Clean design", de: "Sauberes Design" },
  "export.asset.bodyMockup": { en: "Body Mockup", de: "Body-Mockup" },
  "export.share": { en: "Share", de: "Teilen" },
  "export.shareText": {
    en: "my next tattoo, made with InkPreview",
    de: "mein nächstes Tattoo, gemacht mit InkPreview",
  },
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
  "notfound.title": {
    en: "This flash isn't on the wall",
    de: "Dieses Flash hängt nicht an der Wand",
  },
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
  "export.newDesign": { en: "New design", de: "Neues Design" },

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

  // ── Night Parlour redesign ──
  "nav.skip": { en: "Skip to content", de: "Zum Inhalt springen" },
  "create.form.title": { en: "Consultation", de: "Beratung" },
  "create.ink.label": { en: "Ink", de: "Farbe" },
  "create.how.label": { en: "How it works", de: "So funktioniert's" },
  "create.how.title": {
    en: "From idea to skin in three sittings",
    de: "Von der Idee auf die Haut in drei Schritten",
  },
  "create.how.1.title": { en: "Sketch", de: "Skizze" },
  "create.how.1.body": {
    en: "Describe your idea. The AI draws a clean, artist-ready flash.",
    de: "Beschreib deine Idee. Die KI zeichnet ein sauberes, artist-fertiges Flash.",
  },
  "create.how.2.title": { en: "Stencil", de: "Schablone" },
  "create.how.2.body": {
    en: "Snap the spot. Place, size and turn the stencil on your own skin.",
    de: "Knips die Stelle. Setz, skalier und dreh die Schablone auf deiner Haut.",
  },
  "create.how.3.title": { en: "Ink", de: "Stechen" },
  "create.how.3.body": {
    en: "The AI inks it onto your photo — then take the files to your artist.",
    de: "Die KI sticht es auf dein Foto — dann nimmst du die Dateien mit zu deinem Artist.",
  },
  "create.fresh.all": { en: "See the whole wall", de: "Die ganze Wand ansehen" },
  "result.label": { en: "Fresh flash", de: "Frisches Flash" },
  "result.refine.title": { en: "Note for the artist", de: "Notiz für den Artist" },
  "result.variants.label": { en: "Versions", de: "Versionen" },
  "studio.step.photo": { en: "Photo", de: "Foto" },
  "studio.step.stencil": { en: "Stencil", de: "Schablone" },
  "studio.step.ink": { en: "Ink", de: "Tattoo" },
  "studio.stencil.note": {
    en: "Stencil preview — the AI inks it in the next step.",
    de: "Schablonen-Vorschau — die KI sticht es im nächsten Schritt.",
  },
  "studio.upload.or": { en: "or", de: "oder" },
  "export.ticket.title": { en: "Artist ticket", de: "Artist-Ticket" },
  "export.ticket.date": { en: "Date", de: "Datum" },
  "export.ticket.flash": { en: "Flash", de: "Flash" },
  "export.ticket.files": { en: "Files", de: "Dateien" },
  "export.asset.cleanMeta.free": { en: "PNG · watermarked", de: "PNG · mit Wasserzeichen" },
  "export.asset.stencilMeta": {
    en: "Linework for the thermal printer",
    de: "Linien für den Thermodrucker",
  },
  "export.asset.mockupMeta": { en: "Your preview on skin", de: "Deine Vorschau auf der Haut" },
  "account.card.label": { en: "Client card", de: "Kundenkarte" },
  "consent.title": { en: "Cookies", de: "Cookies" },
  "pricing.label": { en: "Price board", de: "Preistafel" },
  "legal.back": { en: "Back to InkPreview", de: "Zurück zu InkPreview" },

  // ── Wait states ──
  "ritual.title.draw": { en: "Drawing your flash", de: "Dein Flash entsteht" },
  "ritual.title.refine": { en: "Reworking your flash", de: "Dein Flash wird überarbeitet" },
  "ritual.title.place": { en: "Inking your skin", de: "Jetzt wird gestochen" },
  "ritual.gen.1": { en: "Sketching the idea", de: "Skizziert die Idee" },
  "ritual.gen.2": { en: "Pulling the lines", de: "Zieht die Linien" },
  "ritual.gen.3": { en: "Adding shading and colour", de: "Setzt Schatten und Farbe" },
  "ritual.place.1": { en: "Transferring the stencil", de: "Überträgt die Schablone" },
  "ritual.place.2": { en: "Inking the lines", de: "Sticht die Linien" },
  "ritual.place.3": { en: "Matching light and skin", de: "Passt Licht und Haut an" },
  "ritual.stage.sketch": { en: "Sketch", de: "Skizze" },
  "ritual.stage.lines": { en: "Lines", de: "Linien" },
  "ritual.stage.shade": { en: "Shading", de: "Schatten" },
  "ritual.stage.stencil": { en: "Stencil", de: "Schablone" },
  "ritual.stage.ink": { en: "Ink", de: "Tinte" },
  "ritual.stage.skin": { en: "Skin", de: "Haut" },
  "ritual.hint": { en: "Usually takes under a minute", de: "Dauert meist unter einer Minute" },
  "ritual.tip.label": { en: "Studio tip", de: "Studio-Tipp" },
  "ritual.tip.1": {
    en: "Fine lines soften as they heal — size up a little to keep the detail crisp.",
    de: "Feine Linien werden beim Abheilen weicher — plan lieber etwas größer, dann bleiben Details scharf.",
  },
  "ritual.tip.2": {
    en: "Stencils are printed on thermal paper in violet — that's the colour you'll see at the studio.",
    de: "Schablonen werden auf Thermopapier in Violett gedruckt — genau diese Farbe siehst du im Studio.",
  },
  "ritual.tip.3": {
    en: "Old-school shops sold flash straight off the wall: pick a number, get it inked.",
    de: "Old-School-Shops verkauften Flash direkt von der Wand: Nummer aussuchen, stechen lassen.",
  },
  "ritual.tip.4": {
    en: "Bring the artist file to your consultation — it can save a round of sketches.",
    de: "Bring die Artist-Datei zur Beratung mit — das kann eine Skizzenrunde sparen.",
  },
  "ritual.tip.5": {
    en: "A healed tattoo looks calmer than a fresh one: the shine fades, the lines settle.",
    de: "Ein abgeheiltes Tattoo wirkt ruhiger als ein frisches: Der Glanz geht, die Linien setzen sich.",
  },
  "ritual.tip.6": {
    en: "Your artist will adapt the design to your body — that's part of the craft.",
    de: "Dein Artist passt das Design an deinen Körper an — das gehört zum Handwerk.",
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
