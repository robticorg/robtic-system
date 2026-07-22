import { COMBO_LEVELS, type ComboLevelName } from "@constants";

export function levelForScore(score: number): ComboLevelName {
    let result: ComboLevelName = COMBO_LEVELS[0].name;
    for (const tier of COMBO_LEVELS) {
        if (score >= tier.minScore) result = tier.name;
    }
    return result;
}
