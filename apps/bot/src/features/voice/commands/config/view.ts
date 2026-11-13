import { EmbedBuilder, type GuildMember } from "discord.js";
import type { FeatureSubcommandHandler } from "@typings/feature";
import { COLORS } from "@constants";
import { VoiceSettingsRepository } from "@database/repositories";
import { hasGuildBotAdmin } from "@bot/utils/access";

import { L } from "@utils";
const list = (ids: string[], empty: string) => (ids.length ? ids.map(id => `<#${id}>`).join(", ") : empty);

export const view: FeatureSubcommandHandler = async (interaction, _client) => {
    const member = interaction.member as GuildMember | null;
    if (!member || !(await hasGuildBotAdmin(member))) {
        await interaction.editReply({ content: L("Only administrators can view the voice settings.", "عرض إعدادات الصوت للإدارة فقط.") });
        return;
    }

    const s = await VoiceSettingsRepository.getCached(interaction.guildId!);
    const afkChannelId = interaction.guild?.afkChannelId;

    await interaction.editReply({
        embeds: [new EmbedBuilder()
            .setTitle(L("🎙️ Voice settings", "🎙️ إعدادات الصوت"))
            .setColor(s.enabled ? COLORS.info : COLORS.warning)
            .addFields(
                { name: L("Status", "الحالة"), value: s.enabled ? L("On", "مفعّل") : L("Off", "مقفل"), inline: true },
                { name: L("Alone multiplier", "مضاعف الوحدة"), value: `${Math.round(s.aloneMultiplier * 100)}%`, inline: true },
                { name: L("AFK timeout", "مهلة عدم النشاط"), value: L(`${s.afkTimeoutMinutes} min`, `${s.afkTimeoutMinutes} دقيقة`), inline: true },
                { name: L("Tracked channels", "الرومات المتتبعة"), value: list(s.trackedChannelIds, L("All voice channels", "كل الرومات الصوتية")) },
                { name: L("Excluded channels", "الرومات المستثناة"), value: list(s.excludedChannelIds, L("None", "لا يوجد")) },
                { name: L("Allowed roles", "الرتب المسموحة"), value: s.allowedRoleIds.length ? s.allowedRoleIds.map(id => `<@&${id}>`).join(", ") : L("Everyone", "الكل") },
                { name: L("Server AFK channel", "روم AFK في السيرفر"), value: afkChannelId ? L(`<#${afkChannelId}> — never earns`, `<#${afkChannelId}> — ما يحصل شي`) : L("Not set", "غير محدد") },
            )
            .setFooter({ text: L("Muted and deafened members still earn, as long as they have been active recently.", "الميوت والصم يحصلون مكافآت ما داموا نشطين مؤخراً.") })],
    });
};
