import type { FeatureComponentIndex } from "@typings/feature";
import { streakRewardClaimHandler } from "./components/reward-claim";
import { streakTopToggleHandler } from "./components/top-toggle";

export default {
    feature: "streak",
    handlers: [
        streakRewardClaimHandler,
        streakTopToggleHandler,
    ],
} satisfies FeatureComponentIndex;
