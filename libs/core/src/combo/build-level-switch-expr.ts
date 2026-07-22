import { COMBO_LEVELS } from "@constants";

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
