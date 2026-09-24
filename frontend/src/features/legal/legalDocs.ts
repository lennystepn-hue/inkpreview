/**
 * Legal pages content (Impressum / Datenschutz / AGB), DE + EN.
 *
 * Operator details mirror the MenuMagic legal pages (same operator). The German
 * versions are legally authoritative; English is a courtesy translation. These
 * are solid drafts based on the live processing — have them reviewed before
 * relying on them for anything contentious.
 */

import type { Lang } from "@/lib/i18n";

export type LegalDocKey = "impressum" | "datenschutz" | "agb";

export type LegalSection = { h: string; p: string[] };
export type LegalDoc = { title: string; updated: string; sections: LegalSection[] };

const OPERATOR = "Lenny David Enderle";
const ADDRESS = "Rua Padre Manuel Bernardes 16, 5 Esq.\n2825-359 Costa da Caparica\nPortugal";
const EMAIL = "contact@lenny.services";
const VAT = "PT297035770";

export const legalDocs: Record<LegalDocKey, Record<Lang, LegalDoc>> = {
  impressum: {
    de: {
      title: "Impressum",
      updated: "Stand: Juni 2026",
      sections: [
        { h: "Angaben gemäß § 5 DDG", p: [`${OPERATOR}\n${ADDRESS}`] },
        { h: "Kontakt", p: [`E-Mail: ${EMAIL}\nWebsite: ink-preview.com`] },
        { h: "Umsatzsteuer-Identifikationsnummer", p: [`USt-IdNr.: ${VAT}`] },
        {
          h: "Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV",
          p: [`${OPERATOR} (Anschrift wie oben)`],
        },
        {
          h: "EU-Streitschlichtung",
          p: [
            "Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: https://ec.europa.eu/consumers/odr. Unsere E-Mail-Adresse finden Sie oben.",
          ],
        },
        {
          h: "Verbraucherstreitbeilegung / Universalschlichtungsstelle",
          p: [
            "Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.",
          ],
        },
        {
          h: "Haftung für Inhalte",
          p: [
            "Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.",
          ],
        },
        {
          h: "Haftung für Links",
          p: [
            "Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.",
          ],
        },
        {
          h: "Urheberrecht",
          p: [
            "Die durch den Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem Urheberrecht. Von dir mit InkPreview erstellte Tattoo-Designs darfst du frei für deine eigenen Zwecke nutzen (siehe AGB).",
          ],
        },
      ],
    },
    en: {
      title: "Legal Notice (Impressum)",
      updated: "Last updated: June 2026",
      sections: [
        { h: "Information pursuant to § 5 DDG", p: [`${OPERATOR}\n${ADDRESS}`] },
        { h: "Contact", p: [`Email: ${EMAIL}\nWebsite: ink-preview.com`] },
        { h: "VAT identification number", p: [`VAT ID: ${VAT}`] },
        { h: "Responsible for content (§ 18 (2) MStV)", p: [`${OPERATOR} (address as above)`] },
        {
          h: "EU online dispute resolution",
          p: [
            "The European Commission provides a platform for online dispute resolution (ODR): https://ec.europa.eu/consumers/odr. Our email address is above.",
          ],
        },
        {
          h: "Consumer dispute resolution",
          p: [
            "We are not willing or obliged to participate in dispute resolution proceedings before a consumer arbitration board.",
          ],
        },
        {
          h: "Liability for content & links",
          p: [
            "As a service provider we are responsible for our own content on these pages under general law. We are not obliged to monitor third-party information transmitted or stored. Our offering contains links to external third-party sites over whose content we have no influence and for which we assume no liability.",
          ],
        },
        {
          h: "Copyright",
          p: [
            "Content created by the operator on these pages is subject to copyright. Tattoo designs you create with InkPreview may be used freely for your own purposes (see the Terms).",
          ],
        },
      ],
    },
  },

  datenschutz: {
    de: {
      title: "Datenschutzerklärung",
      updated: "Stand: September 2026",
      sections: [
        {
          h: "1. Verantwortlicher",
          p: [
            `Verantwortlich für die Datenverarbeitung auf dieser Website ist:\n${OPERATOR}\n${ADDRESS}\nE-Mail: ${EMAIL}`,
          ],
        },
        {
          h: "2. Überblick & Grundsätze",
          p: [
            "InkPreview ist ein KI-Tattoo-Designer: Du beschreibst ein Motiv, die KI erzeugt ein Design, und du kannst es auf einem Foto deiner eigenen Haut platzieren. Wir verarbeiten personenbezogene Daten nur, soweit dies für den Betrieb und die Funktionen des Dienstes erforderlich ist.",
            "Rechtsgrundlagen sind insbesondere die Vertragserfüllung bzw. vorvertragliche Maßnahmen (Art. 6 Abs. 1 lit. b DSGVO), unsere berechtigten Interessen (Art. 6 Abs. 1 lit. f), deine Einwilligung (Art. 6 Abs. 1 lit. a) sowie gesetzliche Pflichten (Art. 6 Abs. 1 lit. c).",
          ],
        },
        {
          h: "3. Welche Daten wir verarbeiten",
          p: [
            "• Konto-/Anmeldedaten: bei Anmeldung mit Google deine E-Mail-Adresse, dein Name und dein Profilbild (Google-Kennung). Ohne Anmeldung nutzen wir ein anonymes, signiertes Sitzungs-Token (lokal in deinem Browser gespeichert).",
            "• Design-Daten: die von dir eingegebenen Text-Prompts und die daraus generierten Tattoo-Designs (dauerhaft gespeichert, damit du sie wiederfindest).",
            "• Körperfotos: von dir hochgeladene Fotos der Körperstelle, auf der das Tattoo platziert werden soll. Diese sind flüchtig und werden automatisch innerhalb von 24 Stunden gelöscht. Die gerenderte On-Skin-Vorschau wird – sofern du sie speicherst – nur mit deiner ausdrücklichen Einwilligung dauerhaft gespeichert.",
            "• Technische Daten: IP-Adresse, Datum/Uhrzeit, Geräte-/Browser-Informationen und Server-Logs sowie das über Cloudflare ermittelte Herkunftsland (zur automatischen Sprachwahl).",
            "• Nutzungsdaten: mit deiner Einwilligung anonymisierte Statistik via Google Analytics.",
          ],
        },
        {
          h: "4. Eingesetzte Dienstleister (Auftragsverarbeiter)",
          p: [
            "Wir setzen sorgfältig ausgewählte Dienstleister ein, mit denen Auftragsverarbeitungsverträge (Art. 28 DSGVO) bestehen:",
            "• Cloudflare, Inc. (USA) – Hosting, Datenbank und Dateispeicher (Speicherort EU), Auslieferung, Sicherheit, TLS-Verschlüsselung, Geo-Erkennung.",
            "• OpenAI, L.L.C. (USA) – KI-Bildgenerierung und realistische Platzierung auf dem Körperfoto. Hierbei werden dein Prompt, das generierte Design und – für die Vorschau – dein Körperfoto an OpenAI übermittelt.",
            "• Google Ireland Ltd. (Irland/USA) – „Mit Google anmelden\" (OAuth) sowie Google Analytics 4 (nur mit Einwilligung).",
            "• Stripe Payments Europe, Ltd. (Irland/USA) – Zahlungsabwicklung für kostenpflichtige Pläne (sobald aktiv).",
          ],
        },
        {
          h: "5. Datenübermittlung in die USA",
          p: [
            "Einige Dienstleister sitzen in den USA. Soweit dort Daten verarbeitet werden, erfolgt dies auf Grundlage der EU-Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO) bzw. – soweit zertifiziert – des EU-US Data Privacy Framework. Ein dem EU-Niveau entsprechendes Datenschutzniveau kann nicht in allen Fällen garantiert werden.",
          ],
        },
        {
          h: "6. Cookies & Analyse / Einwilligung",
          p: [
            "Technisch notwendige Speicherungen (z. B. dein Sitzungs-Token, die Sprachwahl) sind für den Betrieb erforderlich. Google Analytics und vergleichbare nicht notwendige Dienste werden erst nach deiner ausdrücklichen Einwilligung über unser Consent-Banner geladen (Google Consent Mode). Du kannst deine Einwilligung jederzeit über den Link im Footer widerrufen.",
          ],
        },
        {
          h: "7. Speicherdauer",
          p: [
            "• Körperfotos: automatische Löschung innerhalb von 24 Stunden.\n• Konten & Designs: bis zur Löschung deines Kontos.\n• Rechnungen/steuerrelevante Daten: bis zu 10 Jahre (gesetzliche Aufbewahrung).\n• Server-Logs: in der Regel 14 Tage.",
          ],
        },
        {
          h: "8. Deine Rechte",
          p: [
            "Du hast nach DSGVO das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21) sowie das Recht, eine erteilte Einwilligung jederzeit zu widerrufen. Kontaktiere uns dazu unter " +
              EMAIL +
              ". Dein Konto und die damit verbundenen Daten kannst du zudem jederzeit selbst löschen.",
          ],
        },
        {
          h: "9. Beschwerderecht",
          p: [
            "Du hast das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren – etwa der portugiesischen CNPD (Comissão Nacional de Proteção de Dados) oder der für deinen Wohnsitz zuständigen Behörde.",
          ],
        },
      ],
    },
    en: {
      title: "Privacy Policy",
      updated: "Last updated: September 2026",
      sections: [
        {
          h: "1. Controller",
          p: [
            `The controller responsible for data processing on this website is:\n${OPERATOR}\n${ADDRESS}\nEmail: ${EMAIL}`,
          ],
        },
        {
          h: "2. Overview & principles",
          p: [
            "InkPreview is an AI tattoo designer: you describe a motif, the AI creates a design, and you can place it on a photo of your own skin. We process personal data only as far as necessary to operate and provide the service.",
            "Legal bases are in particular performance of a contract / pre-contractual steps (Art. 6(1)(b) GDPR), our legitimate interests (Art. 6(1)(f)), your consent (Art. 6(1)(a)) and legal obligations (Art. 6(1)(c)).",
          ],
        },
        {
          h: "3. Data we process",
          p: [
            "• Account/login data: if you sign in with Google, your email, name and profile picture (Google ID). Without an account we use an anonymous signed session token stored locally in your browser.",
            "• Design data: the text prompts you enter and the tattoo designs generated from them (stored so you can find them again).",
            "• Body photos: photos of the body part you upload for placement. These are ephemeral and automatically deleted within 24 hours. The rendered on-skin preview is only stored permanently if you choose to save it, with your explicit consent.",
            "• Technical data: IP address, date/time, device/browser info and server logs, plus the country determined via Cloudflare (for automatic language selection).",
            "• Usage data: with your consent, anonymized statistics via Google Analytics.",
          ],
        },
        {
          h: "4. Processors we use",
          p: [
            "We use carefully selected processors under data processing agreements (Art. 28 GDPR):",
            "• Cloudflare, Inc. (USA) – hosting, database and file storage (stored in the EU), delivery, security, TLS, geo detection.",
            "• OpenAI, L.L.C. (USA) – AI image generation and realistic placement on the body photo. Your prompt, the generated design and – for the preview – your body photo are transmitted to OpenAI.",
            "• Google Ireland Ltd. (Ireland/USA) – Sign in with Google (OAuth) and Google Analytics 4 (only with consent).",
            "• Stripe Payments Europe, Ltd. (Ireland/USA) – payment processing for paid plans (once active).",
          ],
        },
        {
          h: "5. Transfers to the USA",
          p: [
            "Some processors are based in the USA. Where data is processed there, this is based on the EU Standard Contractual Clauses (Art. 46(2)(c) GDPR) or, where certified, the EU-US Data Privacy Framework.",
          ],
        },
        {
          h: "6. Cookies & analytics / consent",
          p: [
            "Technically necessary storage (e.g. your session token, language choice) is required to operate the service. Google Analytics and comparable non-essential services are loaded only after your explicit consent via our consent banner (Google Consent Mode). You can withdraw consent anytime via the footer link.",
          ],
        },
        {
          h: "7. Retention",
          p: [
            "• Body photos: automatically deleted within 24 hours.\n• Accounts & designs: until you delete your account.\n• Invoices/tax-relevant data: up to 10 years (legal retention).\n• Server logs: typically 14 days.",
          ],
        },
        {
          h: "8. Your rights",
          p: [
            "Under the GDPR you have the right to access (Art. 15), rectification (Art. 16), erasure (Art. 17), restriction (Art. 18), data portability (Art. 20) and objection (Art. 21), and to withdraw consent at any time. Contact us at " +
              EMAIL +
              ". You can also delete your account and associated data yourself at any time.",
          ],
        },
        {
          h: "9. Right to complain",
          p: [
            "You have the right to lodge a complaint with a data protection authority – e.g. the Portuguese CNPD or the authority responsible for your place of residence.",
          ],
        },
      ],
    },
  },

  agb: {
    de: {
      title: "Allgemeine Geschäftsbedingungen (AGB)",
      updated: "Stand: Juni 2026",
      sections: [
        {
          h: "§ 1 Geltungsbereich",
          p: [
            `Diese AGB gelten für alle Verträge über die Nutzung des Dienstes „InkPreview\" zwischen ${OPERATOR} (nachfolgend „Anbieter\") und seinen Nutzerinnen und Nutzern.`,
          ],
        },
        {
          h: "§ 2 Leistungsbeschreibung",
          p: [
            "InkPreview ermöglicht es, mithilfe von KI Tattoo-Designs zu erzeugen, sie auf einem hochgeladenen Foto einer Körperstelle realistisch darzustellen (Vorschau) und Design- bzw. Mockup-Dateien zu exportieren.",
            "Die Vorschau ist eine unverbindliche Illustration und kein verbindliches Abbild des späteren Tattoos. Das tatsächliche Ergebnis hängt von Tätowierer:in, Hauttyp und Ausführung ab. Für die endgültige Gestaltung ist allein das Tattoo-Studio verantwortlich.",
          ],
        },
        {
          h: "§ 3 Vertragsschluss",
          p: [
            "Die Darstellung der Tarife ist unverbindlich. Ein Vertrag über einen kostenpflichtigen Plan kommt zustande, wenn du den Bestellvorgang abschließt und der Anbieter bzw. der Zahlungsdienstleister die Zahlung bestätigt.",
          ],
        },
        {
          h: "§ 4 Tarife und Preise",
          p: [
            "Der Dienst ist in einer kostenlosen Variante mit begrenztem Kontingent nutzbar. Der Tarif „Pro\" kostet 9,99 € pro Monat und schaltet u. a. unbegrenzte Generierungen sowie den sauberen, hochaufgelösten Export ohne Wasserzeichen frei. Preise gegenüber Verbrauchern verstehen sich inkl. etwaiger Umsatzsteuer.",
          ],
        },
        {
          h: "§ 5 Zahlung",
          p: [
            "Die Zahlung erfolgt über den Zahlungsdienstleister Stripe. Es gelten zusätzlich dessen Bedingungen für die Zahlungsabwicklung.",
          ],
        },
        {
          h: "§ 6 Laufzeit und Kündigung",
          p: [
            "Das Pro-Abonnement läuft zunächst einen Monat und verlängert sich automatisch monatlich, sofern es nicht gekündigt wird. Du kannst jederzeit zum Ende des laufenden Abrechnungszeitraums kündigen.",
          ],
        },
        {
          h: "§ 7 Widerrufsrecht für Verbraucher",
          p: [
            "Verbrauchern steht ein gesetzliches 14-tägiges Widerrufsrecht zu. Bei digitalen Inhalten/Dienstleistungen erlischt das Widerrufsrecht, wenn du ausdrücklich zustimmst, dass wir vor Ablauf der Widerrufsfrist mit der Leistung beginnen, und du bestätigst, dass du dadurch dein Widerrufsrecht verlierst.",
          ],
        },
        {
          h: "§ 8 KI-gestützte Verarbeitung",
          p: [
            "Die Inhalte werden mithilfe von KI erzeugt. Eine Gewähr für die Richtigkeit, Vollständigkeit oder eine bestimmte künstlerische Qualität der KI-Ergebnisse ist ausgeschlossen. Du bist verantwortlich, Ergebnisse vor einer Tätowierung mit deinem Studio zu prüfen.",
          ],
        },
        {
          h: "§ 9 Nutzungsrechte",
          p: [
            "An den von dir erzeugten Designs erhältst du ein zeitlich und räumlich unbeschränktes Nutzungsrecht für deine eigenen (auch tätowierungsbezogenen) Zwecke. Für hochgeladene Fotos und Vorlagen musst du über die erforderlichen Rechte verfügen; du stellst den Anbieter von Ansprüchen Dritter frei.",
          ],
        },
        {
          h: "§ 10 Pflichten der Nutzer",
          p: [
            "Du verpflichtest dich, keine rechtswidrigen, rechtsverletzenden, beleidigenden, gewaltverherrlichenden, diskriminierenden oder die Rechte Dritter verletzenden Inhalte zu erzeugen oder hochzuladen. Zugangsdaten sind vertraulich zu behandeln.",
          ],
        },
        {
          h: "§ 11 Verfügbarkeit",
          p: [
            "Der Anbieter gewährleistet keine bestimmte Verfügbarkeit. Wartungsfenster und Ausfälle (auch durch Drittanbieter) sind möglich.",
          ],
        },
        {
          h: "§ 12 Haftung",
          p: [
            "Für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit sowie bei Vorsatz und grober Fahrlässigkeit haftet der Anbieter unbeschränkt. Bei einfacher Fahrlässigkeit haftet er nur bei Verletzung wesentlicher Vertragspflichten (Kardinalpflichten), begrenzt auf den vertragstypischen, vorhersehbaren Schaden. Eine darüber hinausgehende Haftung ist ausgeschlossen.",
          ],
        },
        {
          h: "§ 13 Höhere Gewalt",
          p: [
            "Der Anbieter haftet nicht für Ausfälle durch Ereignisse außerhalb seines Einflussbereichs (z. B. Naturereignisse, Streiks, Pandemien, Ausfälle von Infrastruktur- oder Drittanbietern).",
          ],
        },
        {
          h: "§ 14 Datenschutz",
          p: ["Die Verarbeitung personenbezogener Daten richtet sich nach unserer Datenschutzerklärung."],
        },
        {
          h: "§ 15 Änderungen der AGB",
          p: [
            "Der Anbieter kann diese AGB mit Wirkung für die Zukunft ändern, etwa zur Anpassung an Rechtslage, technische Entwicklung oder Leistungsumfang, und informiert hierüber in angemessener Weise.",
          ],
        },
        {
          h: "§ 16 Anwendbares Recht und Streitbeilegung",
          p: [
            "Es gilt portugiesisches Recht unter Ausschluss des UN-Kaufrechts; zwingende Verbraucherschutzvorschriften deines Wohnsitzstaates bleiben unberührt. Auf die EU-OS-Plattform (https://ec.europa.eu/consumers/odr) wird hingewiesen.",
          ],
        },
        {
          h: "§ 17 Salvatorische Klausel",
          p: [
            "Sollte eine Bestimmung unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.",
          ],
        },
      ],
    },
    en: {
      title: "Terms of Service",
      updated: "Last updated: June 2026",
      sections: [
        {
          h: "§ 1 Scope",
          p: [
            `These Terms apply to all contracts for the use of the “InkPreview” service between ${OPERATOR} (“Provider”) and its users.`,
          ],
        },
        {
          h: "§ 2 Service description",
          p: [
            "InkPreview lets you generate tattoo designs with AI, preview them realistically on an uploaded photo of a body part, and export design and mockup files.",
            "The preview is a non-binding illustration, not a guaranteed depiction of the final tattoo. The actual result depends on the tattoo artist, skin type and execution. The studio is solely responsible for the final work.",
          ],
        },
        {
          h: "§ 3 Conclusion of contract",
          p: [
            "Tariff displays are non-binding. A contract for a paid plan is concluded when you complete the order and the Provider/payment processor confirms payment.",
          ],
        },
        {
          h: "§ 4 Plans and prices",
          p: [
            "The service is usable in a free tier with a limited quota. The “Pro” plan costs €9.99 per month and unlocks, among other things, unlimited generations and the clean, high-resolution export without watermark. Prices to consumers include any applicable VAT.",
          ],
        },
        { h: "§ 5 Payment", p: ["Payment is processed via the payment provider Stripe, whose terms additionally apply."] },
        {
          h: "§ 6 Term and cancellation",
          p: [
            "The Pro subscription runs for an initial month and renews automatically each month unless cancelled. You can cancel any time, effective at the end of the current billing period.",
          ],
        },
        {
          h: "§ 7 Right of withdrawal (consumers)",
          p: [
            "Consumers have a statutory 14-day right of withdrawal. For digital content/services the right of withdrawal lapses if you expressly agree that we begin performance before the withdrawal period ends and acknowledge that you thereby lose your right of withdrawal.",
          ],
        },
        {
          h: "§ 8 AI processing",
          p: [
            "Content is generated using AI. No warranty is given for the accuracy, completeness or any particular artistic quality of AI results. You are responsible for verifying results with your studio before getting tattooed.",
          ],
        },
        {
          h: "§ 9 Usage rights",
          p: [
            "You receive an unlimited right to use the designs you generate for your own (including tattoo-related) purposes. For uploaded photos and references you must hold the necessary rights and indemnify the Provider against third-party claims.",
          ],
        },
        {
          h: "§ 10 User obligations",
          p: [
            "You must not generate or upload unlawful, infringing, offensive, violent, discriminatory or rights-violating content. Keep your credentials confidential.",
          ],
        },
        { h: "§ 11 Availability", p: ["The Provider does not warrant any particular availability. Maintenance windows and outages (including by third parties) may occur."] },
        {
          h: "§ 12 Liability",
          p: [
            "The Provider is liable without limitation for injury to life, body or health and for intent and gross negligence. For ordinary negligence it is liable only for breach of essential contractual duties, limited to typical foreseeable damage. Any further liability is excluded.",
          ],
        },
        { h: "§ 13 Force majeure", p: ["The Provider is not liable for outages caused by events beyond its control (e.g. natural events, strikes, pandemics, infrastructure or third-party failures)."] },
        { h: "§ 14 Data protection", p: ["Processing of personal data is governed by our Privacy Policy."] },
        {
          h: "§ 15 Changes to these Terms",
          p: [
            "The Provider may amend these Terms with effect for the future, e.g. to adapt to the legal situation, technical development or scope of service, and will give reasonable notice.",
          ],
        },
        {
          h: "§ 16 Governing law and dispute resolution",
          p: [
            "Portuguese law applies, excluding the UN Sales Convention; mandatory consumer-protection provisions of your country of residence remain unaffected. We point to the EU ODR platform (https://ec.europa.eu/consumers/odr).",
          ],
        },
        { h: "§ 17 Severability", p: ["Should any provision be invalid, the validity of the remaining provisions is unaffected."] },
      ],
    },
  },
};
