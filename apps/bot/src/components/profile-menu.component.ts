import {
    StringSelectMenuInteraction,
    EmbedBuilder,
    MessageFlags,
} from "discord.js";
import type { BotClient } from "@core/bot-client";
import { COLORS, INTERACTION_MESSAGES } from "@constants";
import { PunishmentRepository, NoteRepository, ActivityRepository, UserRepository } from "@database/repositories";
import type { ComponentHandler } from "@typings/command";
import { levelProgress } from "@core/xp";
import { getStaffActivity, getSupportStats, getActivityLogs } from "@bot/utils/staff-activity";
import { getStreakSummary } from "@core/streak";
import { getProfileTab } from "@core/profile";
import { isFeatureEnabled } from "@core/features";
import { buildProfileSettingsRow, buildSettingsEmbed } from "./profile-settings-buttons.component";
import { L, formatDuration } from "@utils";
import { isStaff } from "@bot/utils/access";
import { getUserLang, t } from "@bot/utils/lang";
import type { GuildMember } from "discord.js";
import { BRANCH_EMOJIS as emoji } from "@config";

export const profileMenuHandler: ComponentHandler<StringSelectMenuInteraction> = {
    customId: /^profile_menu_\d+$/,

    async run(interaction: StringSelectMenuInteraction, client: BotClient) {
        const targetId = interaction.customId.split("_")[2];
        const selected = interaction.values[0];
        const guildId = interaction.guildId!;

        if (selected === "settings") {
            if (interaction.user.id !== targetId) {
                await interaction.deferUpdate();
                return;
            }
            const member = interaction.member as GuildMember | null;
            const lang = await getUserLang(member);
            const privateProfile = await UserRepository.getPrivateProfile(targetId);
            const embed = await buildSettingsEmbed(interaction.user, lang);

            await interaction.update({ embeds: [embed], components: [buildProfileSettingsRow(targetId, lang, privateProfile)] });
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const user = await client.users.fetch(targetId).catch(() => null);
        const putUser = interaction.user.id === targetId && "— " + user?.username || "";
        const member = interaction.member as GuildMember | null;
        const lang = await getUserLang(member);

        if (selected === "activity") {
            const record = await ActivityRepository.findOrCreate(targetId, guildId, "unknown");
            const message = levelProgress(record.messageXP ?? 0);
            const voice = levelProgress(record.voiceXP ?? 0);
            const rank = await ActivityRepository.getRank(targetId, guildId);
            const bar = (p: ReturnType<typeof levelProgress>) =>
                `${"█".repeat(Math.round((p.progress / p.needed) * 10))}${"░".repeat(10 - Math.round((p.progress / p.needed) * 10))} \`${p.progress}/${p.needed}\``;
            const logs = await getActivityLogs(targetId, guildId, 10);

            const recentLines = logs.length > 0
                ? logs.map(l => `\`${l.type}\` **${l.amount >= 0 ? "+" : ""}${l.amount}** ${l.details ? `— ${l.details}` : ""} <t:${Math.floor(l.createdAt.getTime() / 1000)}:R>`).join("\n")
                : L("No recent activity.", "ما في نشاط حديث.");

            const since = (at: Date | undefined) => (at ? `<t:${Math.floor(at.getTime() / 1000)}:R>` : "never");
            const decayStatus = record.decay.enabled
                ? `Active — 💬 last message ${since(record.decay.messageActiveAt ?? record.decay.lastActiveAt)} · 🎙️ last voice ${since(record.decay.voiceActiveAt ?? record.decay.lastActiveAt)}`
                : "Disabled";

            const embed = new EmbedBuilder()
                .setTitle(L(`${emoji.status} Activity ${putUser}`, `${emoji.status} النشاط ${putUser}`))
                .addFields(
                    { name: L("💬 Message level", "💬 مستوى الرسائل"), value: `**${message.level}** · ${record.messageXP ?? 0} XP\n${bar(message)}`, inline: true },
                    { name: L("🎙️ Voice level", "🎙️ مستوى الصوت"), value: `**${voice.level}** · ${record.voiceXP ?? 0} XP\n${bar(voice)}`, inline: true },
                    { name: L("Total XP", "مجموع الخبرة"), value: L(`${record.totalXP} · Rank #${rank}`, `${record.totalXP} · الترتيب #${rank}`), inline: true },
                    { name: "Messages", value: `${record.messageCount}`, inline: true },
                    { name: L("Real messages", "الرسائل الحقيقية"), value: `${record.realMessageCount}`, inline: true },
                    { name: "Decay", value: decayStatus, inline: false },
                    { name: L("Recent activity", "النشاط الأخير"), value: recentLines.slice(0, 1024) },
                )
                .setColor(COLORS.default)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            return;
        }

        if (selected === "streak") {
            const summary = await getStreakSummary(targetId, guildId, user?.username ?? "unknown");
            const { record, rank, bestRank, expiresInMs, nextClaimMs } = summary;

            const unranked = t("profile.streak_unranked", lang);
            const notAvailable = t("profile.streak_not_available", lang);

            const embed = new EmbedBuilder()
                .setTitle(`🔥 ${t("profile.field_streak", lang)} ${putUser}`)
                .addFields(
                    { name: t("profile.streak_current_label", lang), value: `🔥 ${record.currentStreak}`, inline: true },
                    { name: t("profile.streak_best_label", lang), value: `🏆 ${record.bestStreak}`, inline: true },
                    { name: t("profile.streak_rank_label", lang), value: rank > 0 ? `#${rank}` : unranked, inline: true },
                    { name: t("profile.streak_best_rank_label", lang), value: bestRank > 0 ? `#${bestRank}` : unranked, inline: true },
                    { name: t("profile.streak_next_claim_label", lang), value: nextClaimMs > 0 ? `⏳ ${formatDuration(nextClaimMs)}` : t("profile.streak_available_now", lang), inline: true },
                    { name: t("profile.streak_expires_label", lang), value: expiresInMs !== null ? `💔 ${formatDuration(expiresInMs)}` : notAvailable, inline: true },
                    { name: t("profile.streak_reminder_label", lang), value: record.active ? (record.reminderSent ? t("profile.streak_reminder_sent", lang) : t("profile.streak_reminder_pending", lang)) : notAvailable, inline: true },
                )
                .setColor(COLORS.activity)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            return;
        }

        const tab = getProfileTab(selected);
        if (tab) {
            if (!(await isFeatureEnabled(interaction.guildId!, tab.feature))) {
                await interaction.editReply({ content: INTERACTION_MESSAGES.profileTabDisabled });
                return;
            }

            const target = user ?? { id: targetId, username: "unknown", displayAvatarURL: () => "" };
            const embed = await tab.render(interaction.guild!, {
                id: targetId,
                username: target.username,
                avatarUrl: user?.displayAvatarURL({ size: 256 }) ?? "",
            }, lang);

            await interaction.editReply({ embeds: [embed] });
            return;
        }

        if (selected === "staff_activity") {
            const guildMember = interaction.guild?.members.cache.get(targetId) ?? await interaction.guild?.members.fetch(targetId).catch(() => null);
            if (!guildMember || !(await isStaff(guildMember as GuildMember))) {
                await interaction.editReply({ content: L("This user is not a staff member.", "هذا العضو ليس من الإدارة.") });
                return;
            }

            const staffData = await getStaffActivity(targetId, guildId);
            const supportStats = await getSupportStats(targetId);
            const avgResponse = supportStats.avgResponseMs > 0 ? `${Math.round(supportStats.avgResponseMs / 1000)}s` : L("N/A", "غير متوفر");

            const embed = new EmbedBuilder()
                .setTitle(L(`${emoji.trophy} Staff activity ${putUser}`, `${emoji.trophy} نشاط الإداري ${putUser}`))
                .addFields(
                    { name: L("Support points", "نقاط الدعم"), value: `${staffData.supportPoints}`, inline: true },
                    { name: L("Public chat points", "نقاط الشات العام"), value: `${staffData.publicChatPoints}`, inline: true },
                    { name: L("Staff chat points", "نقاط شات الإدارة"), value: `${staffData.staffChatPoints}`, inline: true },
                    { name: L("Moderation points", "نقاط الإشراف"), value: `${staffData.moderationPoints}`, inline: true },
                    { name: "Penalties", value: `${staffData.penalties}`, inline: true },
                    { name: L("Total staff points", "مجموع نقاط الإدارة"), value: `**${staffData.totalStaffPoints}**`, inline: true },
                    { name: "​", value: "​", inline: true },
                    { name: "​", value: L("**── Support ──**", "**── الدعم ──**") },
                    { name: L("Sessions claimed", "الجلسات المستلمة"), value: `${supportStats.totalClaimed}`, inline: true },
                    { name: L("Sessions resolved", "الجلسات المحلولة"), value: `${supportStats.totalResolved}`, inline: true },
                    { name: L("Average response time", "متوسط وقت الرد"), value: avgResponse, inline: true },
                    { name: L("Support points earned", "نقاط الدعم المكتسبة"), value: `${supportStats.totalPoints}`, inline: true },
                )
                .setColor(COLORS.default)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            return;
        }

        if (selected === "notes") {
            const notes = await NoteRepository.findByUser(targetId);

            if (!notes.length) {
                await interaction.editReply({ embeds: [new EmbedBuilder().setDescription(L(`No notes found for <@${targetId}>.`, `ما في ملاحظات على <@${targetId}>.`)).setColor(COLORS.info)] });
                return;
            }

            const lines = notes.slice(0, 15).map((n, i) =>
                L(`**${i + 1}.** ${n.content}\n> By <@${n.createdBy}> — <t:${Math.floor(n.createdAt.getTime() / 1000)}:R>`, `**${i + 1}.** ${n.content}\n> بواسطة <@${n.createdBy}> — <t:${Math.floor(n.createdAt.getTime() / 1000)}:R>`)
            );

            const embed = new EmbedBuilder()
                .setTitle(L(`${emoji.info} Notes ${putUser}`, `${emoji.info} الملاحظات ${putUser}`))
                .setDescription(lines.join("\n\n"))
                .setColor(COLORS.info)
                .setFooter({ text: L(`Total: ${notes.length} note(s)`, `المجموع: ${notes.length} ملاحظة`) })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            return;
        }

        if (selected === "history") {
            const all = await PunishmentRepository.findByUser(targetId, guildId);
            const level = await PunishmentRepository.getPunishmentLevel(guildId, targetId);

            if (!all.length) {
                await interaction.editReply({ embeds: [new EmbedBuilder().setDescription(L(`No punishment history for <@${targetId}>.`, `ما في سجل عقوبات لـ <@${targetId}>.`)).setColor(COLORS.info)] });
                return;
            }

            const lines = all.slice(0, 20).map((p, i) => {
                const status = p.appealed ? L("~~Appealed~~", "~~مستأنف~~") : p.active ? L("🔴 Active", "🔴 فعال") : L("⚪ Ended", "⚪ منتهي");
                const typeIcon = p.type === "warn" ? "⚠️" : p.type === "mute" ? "🔇" : "🔨";
                return `**${i + 1}.** ${typeIcon} \`${p.caseId}\` [${p.type.toUpperCase()}] — ${status}\n> ${p.reason} — <t:${Math.floor(p.createdAt.getTime() / 1000)}:R>`;
            });

            const embed = new EmbedBuilder()
                .setTitle(L(`${emoji.note} Punishment history ${putUser}`, `${emoji.note} سجل العقوبات ${putUser}`))
                .setDescription(lines.join("\n\n"))
                .setColor(COLORS.moderation)
                .setFooter({ text: L(`Punishment level ${level}/100 · ${all.length} record(s)`, `مستوى العقوبة ${level}/100 · ${all.length} سجل`) })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }
    },
};
