/**
 * A whole number as people type it: `12`, Arabic-Indic `١٢`, Persian `۱۲`, or a Roman numeral `XII` (any case).
 * Null when the text is none of those, so a word that merely looks Roman-ish ("mix", "civil") never counts.
 *
 * Roman numerals are read strictly (canonical subtractive form, up to 3999): `IIII` and `IC` are refused rather than
 * guessed, because a guess on a message like "c ill" is the bug this exists to avoid.
 */
const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';
const ROMAN = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;
const ROMAN_VALUE: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

/** `١٢` → `12`, `۴۵` → `45`; other characters unchanged. */
export function toAsciiDigits(text: string): string {
    return text.replace(/[٠-٩۰-۹]/g, (d) => String(ARABIC_INDIC.includes(d) ? ARABIC_INDIC.indexOf(d) : PERSIAN.indexOf(d)));
}

export function parseCount(token: string): number | null {
    const text = token.trim();
    if (!text) return null;

    const digits = toAsciiDigits(text);
    if (/^\d+$/.test(digits)) return Number.parseInt(digits, 10);

    const upper = text.toUpperCase();
    if (!ROMAN.test(upper)) return null;
    let total = 0;
    for (let i = 0; i < upper.length; i++) {
        const value = ROMAN_VALUE[upper[i]!]!;
        const next = ROMAN_VALUE[upper[i + 1] ?? ''] ?? 0;
        total += value < next ? -value : value;
    }
    return total > 0 ? total : null;
}
