import { EmbedBuilder, type User } from "discord.js";
import type { IStreak } from "@database/models";
import { COLORS } from "@constants";

import { L } from "@utils";
export async function sendStreakDM(user: User, streak: IStreak): Promise<void> {
    const embed = new EmbedBuilder()
        .setTitle(L("🔥 Daily streak updated!", "🔥 تم تحديث الستريك اليومي!"))
        .addFields(
            { name: L("Current streak", "الستريك الحالي"), value: `${streak.currentStreak}`, inline: true },
            { name: L("Best streak", "أفضل ستريك"), value: `${streak.bestStreak}`, inline: true },
        )
        .setDescription(L("Your next streak opens tomorrow.", "الستريك القادم متاح بكرة."))
        .setColor(COLORS.activity)
        .setTimestamp();

    await user.send({ embeds: [embed] }).catch(() => null);
}
