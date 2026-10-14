/**
 * A number in Arabic words, for the `!dm` variable `[number;letter]`: 1 → واحد, 34 → ثلاثة و اربعون.
 * Written the way the server writes it (no hamza, a space after و). Up to 999,999.
 */

const UNITS = ["", "واحد", "اثنان", "ثلاثة", "اربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
const TEENS = ["عشرة", "احد عشر", "اثنا عشر", "ثلاثة عشر", "اربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
const TENS = ["", "", "عشرون", "ثلاثون", "اربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const HUNDREDS = ["", "مئة", "مئتان", "ثلاثمئة", "اربعمئة", "خمسمئة", "ستمئة", "سبعمئة", "ثمانمئة", "تسعمئة"];

function below100(n: number): string {
    if (n < 10) return UNITS[n]!;
    if (n < 20) return TEENS[n - 10]!;
    const unit = n % 10, ten = Math.floor(n / 10);
    return unit ? `${UNITS[unit]} و ${TENS[ten]}` : TENS[ten]!;
}

function below1000(n: number): string {
    const hundred = Math.floor(n / 100), rest = n % 100;
    return [HUNDREDS[hundred], rest ? below100(rest) : ""].filter(Boolean).join(" و ");
}

function thousands(n: number): string {
    if (n === 1) return "الف";
    if (n === 2) return "الفان";
    if (n <= 10) return `${below100(n)} الاف`;
    return `${below1000(n)} الف`;
}

export function arabicNumberWords(value: number): string {
    const n = Math.floor(Math.abs(value));
    if (n === 0) return "صفر";
    if (n >= 1_000_000) return String(value);
    const thousand = Math.floor(n / 1000), rest = n % 1000;
    return [thousand ? thousands(thousand) : "", rest ? below1000(rest) : ""].filter(Boolean).join(" و ");
}
