import type { CommandConfig } from "@typings/command";
import { buildFeatureCommands } from "@core/features";
import { streakFeature } from "./streak";
import { view } from "./commands/view";
import { top } from "./commands/top";
import { returnStreak } from "./commands/return-streak";

export default buildFeatureCommands(streakFeature, {
    streak: view,
    "streak-top": top,
    "streak-return": returnStreak,
}) satisfies CommandConfig[];
