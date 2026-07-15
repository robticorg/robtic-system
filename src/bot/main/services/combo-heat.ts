import { COMBO_CONFIG } from "@core/config";

/** Exponential decay plus a message-driven gain, clamped to [0, 100]. Heat is UI/statistics only — it never ends a combo on its own. */
export function computeHeat(previousHeat: number, elapsedMs: number, alternating: boolean, confidence: number): number {
    const decayed = previousHeat * Math.pow(0.5, Math.max(0, elapsedMs) / COMBO_CONFIG.heatHalfLifeMs);
    const gain = (alternating ? COMBO_CONFIG.heatGainAlternating : COMBO_CONFIG.heatGainSame) * confidence;
    return Math.max(0, Math.min(100, decayed + gain));
}

export function heatStatusLabel(heat: number): string {
    if (heat >= 80) return "نشط جداً";
    if (heat >= 50) return "نشط";
    if (heat >= 20) return "يبرد";
    return "بارد";
}
