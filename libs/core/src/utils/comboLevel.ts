import { COMBO_LEVELS, type ComboLevelName } from "@core/config";

export function levelForScore(score: number): ComboLevelName {
    let result: ComboLevelName = COMBO_LEVELS[0].name;
    for (const tier of COMBO_LEVELS) {
        if (score >= tier.minScore) result = tier.name;
    }
    return result;
}

/** Mongo aggregation-pipeline `$switch` expression computing the level from a numeric field, for atomic in-DB updates. */
export function buildLevelSwitchExpr(fieldExpr: string = "$currentScore"): Record<string, unknown> {
    const sorted = [...COMBO_LEVELS].sort((a, b) => b.minScore - a.minScore);
    return {
        $switch: {
            branches: sorted.map(tier => ({ case: { $gte: [fieldExpr, tier.minScore] }, then: tier.name })),
            default: COMBO_LEVELS[0].name,
        },
    };
}
