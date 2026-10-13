/** The level-up card: the template image and where the member's avatar, name, level type and level are drawn. */
export const LEVEL_CARD_CONFIG = {
    /** Template, relative to the repo root (4500×1217). Every position below is in its own pixels. */
    templatePath: ["images", "level.png"] as const,
    /** The lettering on the template is Orbitron; names it can't draw (Arabic, …) fall back to a system font. */
    fontPath: ["images", "fonts", "Orbitron.ttf"] as const,
    fontFamily: "Orbitron",
    fallbackFonts: ["Noto Sans Arabic", "Noto Sans", "Segoe UI", "Arial", "sans-serif"] as const,
    /** The card is posted at this fraction of the template's size, as JPEG — the full-size PNG is ~11MB. */
    outputScale: 0.4,
    jpegQuality: 92,
    /** The empty circle on the left. */
    avatar: { centerX: 1462, centerY: 590, radius: 180 },
    /** The member's name, centred in the panel between the two circles; shrunk to fit `maxWidth`. */
    name: { centerX: 2250, centerY: 500, maxWidth: 1000, fontSize: 110, minFontSize: 50, color: "#ffffff" },
    /** "Message Level" / "Voice Level", under the name. */
    kind: { centerX: 2250, centerY: 618, fontSize: 56, color: "#4da3ff" },
    /** The level number, in the right circle above the template's "LVL". */
    level: { centerX: 3026, centerY: 540, maxWidth: 250, fontSize: 130, minFontSize: 60, color: "#ffffff" },
    kindLabels: { message: "Message Level", voice: "Voice Level" },
} as const;
