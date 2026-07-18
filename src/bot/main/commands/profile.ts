import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    MessageFlags,
    type GuildMember,
} from "discord.js";
import type { BotClient } from "@core/BotClient";
import { Colors } from "@core/config";
import { PunishmentRepository, NoteRepository, ActivityRepository, ComboUserStatsRepository, UserRepository } from "@database/repositories";
import { getMemberLevel, isStaff } from "@shared/utils/access";
import { calculateLevel, xpForLevel } from "../../community/services/xp-service";
import { getStaffActivity, getSupportStats } from "@shared/utils/staff-activity";
import { getStreakSummary } from "../services/streak-service";
import { getUserHighestCombo } from "../services/combo-service";
import { getUserLang, t } from "@shared/utils/lang";
import emoji from "@shared/emojis.json";

export default {
    data: new SlashCommandBuilder()
        .setName("profile")
        .setDescription("View a user's profile and information")
        .addUserOption(opt =>
            opt.setName("user").setDescription("The user to view (defaults to yourself)").setRequired(false)
        ),

    async run(interaction: ChatInputCommandInteraction, client: BotClient) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const target = interaction.options.getUser("user") ?? interaction.user;
        const guildId = interaction.guildId!;
        const member = interaction.guild?.members.cache.get(target.id) ?? await interaction.guild?.members.fetch(target.id).catch(() => null);
        const currentUser = interaction.guild?.members.cache.get(interaction.user.id) ?? await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
        const isSelf = target.id === interaction.user.id;

        if(target !== interaction.user && isStaff(member as GuildMember) && !isStaff(currentUser as GuildMember)) return await interaction.editReply({ content: "You cannot view the profile of another staff member." });

        const lang = await getUserLang(currentUser as GuildMember | null);

        const punishmentLevel = await PunishmentRepository.getPunishmentLevel(target.id);
        const levelInfo = PunishmentRepository.getLevelInfo(punishmentLevel);
        const allPunishments = await PunishmentRepository.findByUser(target.id, guildId);
        const activePunishments = allPunishments.filter(p => p.active && !p.appealed);
        const notes = await NoteRepository.findByUser(target.id);

        const staffLevel = member ? getMemberLevel(member) : null;
        const memberIsStaff = member ? isStaff(member) : false;
        const roles = member?.roles.cache
            .filter(r => r.id !== guildId)
            .sort((a, b) => b.position - a.position)
            .map(r => `<@&${r.id}>`)
            .slice(0, 15)
            .join(", ") || "None";

        const levelBar = buildLevelBar(punishmentLevel);

        const xpRecord = await ActivityRepository.findOrCreate(target.id, guildId, target.username);
        const xpLevel = calculateLevel(xpRecord.totalXP);
        const nextLevelXP = xpForLevel(xpLevel + 1);
        const progress = xpRecord.totalXP - xpForLevel(xpLevel);
        const needed = nextLevelXP - xpForLevel(xpLevel);
        const xpBar = buildXPBar(progress, needed);
        const rank = await ActivityRepository.getRank(target.id, guildId);

        const streak = await getStreakSummary(target.id, guildId, target.username);

        const activeCombo = await getUserHighestCombo(guildId, target.id);
        let comboValue: string;
        if (activeCombo) {
            comboValue = t("profile.combo_active_value", lang, { score: `${activeCombo.pair.currentScore}`, partnerId: activeCombo.partnerId });
        } else {
            const comboStats = await ComboUserStatsRepository.get(guildId, target.id);
            comboValue = comboStats && comboStats.bestComboScore > 0
                ? t("profile.combo_best_value", lang, { score: `${comboStats.bestComboScore}` })
                : t("profile.combo_none_value", lang);
        }

        const displayName = await UserRepository.getDisplayName(target.id) ?? target.username;

        const embed = new EmbedBuilder()
            .setTitle(`${emoji.user} ${t("profile.title", lang, { username: displayName })}`)
            .setThumbnail(target.displayAvatarURL({ size: 256 }))
            .setColor(punishmentLevel >= 60 ? Colors.moderation : punishmentLevel >= 20 ? Colors.warning : Colors.info)
            .addFields(
                { name: t("profile.field_user", lang), value: `<@${target.id}>`, inline: true },
                { name: t("profile.field_account_created", lang), value: `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`, inline: true },
                ...(member ? [{ name: t("profile.field_joined_server", lang), value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : "Unknown", inline: true }] : []),
                ...(staffLevel && staffLevel.level !== "Member" ? [{ name: t("profile.field_staff_level", lang), value: `${staffLevel.level} (${staffLevel.score})`, inline: true }] : []),
                { name: t("profile.field_xp_level", lang), value: `${t("profile.xp_level_value", lang, { level: `${xpLevel}`, rank: `${rank}` })}\n${xpBar} \`${progress}/${needed}\` XP`, inline: true },
                { name: t("profile.field_total_xp", lang), value: `${xpRecord.totalXP}`, inline: true },
                { name: t("profile.field_streak", lang), value: t("profile.streak_value", lang, { current: `${streak.record.currentStreak}`, best: `${streak.record.bestStreak}` }), inline: true },
                { name: t("profile.field_combo", lang), value: comboValue, inline: true },
                { name: t("profile.field_roles", lang), value: roles },
            );

        if (memberIsStaff) {
            const staffData = await getStaffActivity(target.id, guildId);
            const supportStats = await getSupportStats(target.id);

            embed.addFields(
                { name: "​", value: `**${emoji.gear} ${t("profile.staff_section", lang)}**` },
                { name: t("profile.field_support_points", lang), value: `${staffData.supportPoints}`, inline: true },
                { name: t("profile.field_penalties", lang), value: `${staffData.penalties}`, inline: true },
                { name: t("profile.field_sessions_resolved", lang), value: `${supportStats.totalResolved}/${supportStats.totalClaimed}`, inline: true },
            );
        }

        embed.addFields(
            { name: "​", value: `**${emoji.scan} ${t("profile.punishment_section", lang)}**` },
            { name: t("profile.field_punishment_level", lang), value: `${levelBar}\n\`${punishmentLevel}/100\` — **${levelInfo.name}**` },
            { name: t("profile.field_active_punishments", lang), value: `${activePunishments.length}`, inline: true },
            { name: t("profile.field_total_records", lang), value: `${allPunishments.length}`, inline: true },
            { name: t("profile.field_notes", lang), value: `${notes.length}`, inline: true },
        ).setTimestamp();

        const menuOptions = [
            { label: t("profile.menu_activity", lang), description: t("profile.menu_activity_desc", lang), value: "activity", emoji: emoji.status },
            { label: t("profile.menu_streak", lang), description: t("profile.menu_streak_desc", lang), value: "streak", emoji: "🔥" },
            { label: t("profile.menu_combo", lang), description: t("profile.menu_combo_desc", lang), value: "combo", emoji: "💬" },
            ...(memberIsStaff ? [{ label: t("profile.menu_staff_activity", lang), description: t("profile.menu_staff_activity_desc", lang), value: "staff_activity", emoji: emoji.trophy }] : []),
            { label: t("profile.menu_projects", lang), description: t("profile.menu_projects_desc", lang), value: "projects", emoji: emoji.computer },
            { label: t("profile.menu_notes", lang), description: t("profile.menu_notes_desc", lang), value: "notes", emoji: emoji.info },
            { label: t("profile.menu_history", lang), description: t("profile.menu_history_desc", lang), value: "history", emoji: emoji.note },
            ...(isSelf ? [{ label: t("profile.menu_settings", lang), description: t("profile.menu_settings_desc", lang), value: "settings", emoji: "⚙️" }] : []),
        ];

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`profile_menu_${target.id}`)
            .setPlaceholder(t("profile.menu_placeholder", lang))
            .addOptions(menuOptions);

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

        await interaction.editReply({ embeds: [embed], components: [row] });
    },
};

function buildLevelBar(level: number): string {
    const total = 20;
    const filled = Math.round((level / 100) * total);
    const empty = total - filled;
    const filledChar = level >= 80 ? "🟥" : level >= 60 ? "🟧" : level >= 40 ? "🟨" : level >= 20 ? "🟩" : "⬜";
    return filledChar.repeat(filled) + "⬛".repeat(empty);
}

function buildXPBar(current: number, max: number): string {
    const total = 10;
    const filled = max > 0 ? Math.round((current / max) * total) : 0;
    return "█".repeat(filled) + "░".repeat(total - filled);
}
