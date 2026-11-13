import { EmbedBuilder } from "discord.js";
import type { FeatureSubcommandHandler } from "@typings/feature";
import { COLORS } from "@constants";
import { getPointRates } from "@core/points";

import { L } from "@utils";
export const rates: FeatureSubcommandHandler = async (interaction, _client) => {
    const r = await getPointRates(interaction.guildId!);

    const lines = [
        L(`• **1** point per **${r.messagesPerPoint}** messages`, `• **1** نقطة لكل **${r.messagesPerPoint}** رسالة`),
        L(`• **1** point per **${r.comboPerPoint}** combo score`, `• **1** نقطة لكل **${r.comboPerPoint}** من نقاط الكومبو`),
        L(`• **1** point per **${r.voiceMinutesPerPoint}** minutes of active voice`, `• **1** نقطة لكل **${r.voiceMinutesPerPoint}** دقيقة صوت نشط`),
        r.streakRewards.length
            ? L(`• Streak rewards: ${r.streakRewards.map(x => `**${x.streak}**d → **${x.points}**`).join(", ")}`, `• مكافآت الستريك: ${r.streakRewards.map(x => `**${x.streak}** يوم ← **${x.points}**`).join("، ")}`)
            : L("• No streak rewards yet", "• ما في مكافآت ستريك"),
    ];

    const conversion = r.conversionEnabled
        ? L(`**${r.pointsPerRc}** points → **1** RC (minimum **${r.minConversionPoints}** points per conversion)`, `**${r.pointsPerRc}** نقطة ← **1** RC (أقل تحويل **${r.minConversionPoints}** نقطة)`)
        : L("Converting to RC is switched off here.", "تحويل النقاط إلى RC مقفل هنا.");

    await interaction.editReply({
        embeds: [new EmbedBuilder()
            .setTitle(L("🎯 How points are earned", "🎯 كيف تنكسب النقاط"))
            .setColor(COLORS.info)
            .setDescription(lines.join("\n"))
            .addFields({ name: L("RC conversion", "التحويل إلى RC"), value: conversion })],
    });
};
