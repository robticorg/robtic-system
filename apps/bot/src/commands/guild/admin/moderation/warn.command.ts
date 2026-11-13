import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    AutocompleteInteraction,
    EmbedBuilder,
    MessageFlags,
    type GuildMember,
} from "discord.js";
import type { BotClient } from "@core/bot-client";
import { COLORS, MEMBER_PUNISHMENTS } from "@constants";
import { PunishmentRepository, ReasonRepository } from "@database/repositories";
import { L, currentLang, errorText } from "@utils";
import { getUserLang, t } from "@bot/utils/lang";
import { canActOn } from "@bot/utils/moderation/hierarchy";
import { needsProof, buildProofModal, openProofRequest, sendShortcutProofDM, awardPunishPoints } from "@bot/utils/moderation/punish-flow";

/** Swaps the member's punishment-step role for the one their level now reaches. */
async function applyLevelRole(member: GuildMember, roleId: string | null): Promise<void> {
    const ladder = new Set<string>(Object.values(MEMBER_PUNISHMENTS).map(p => p.id));
    for (const [, role] of member.roles.cache.filter(r => ladder.has(r.id))) await member.roles.remove(role).catch(() => null);
    if (roleId) await member.roles.add(roleId).catch(() => null);
}

/**
 * Why a moderator may not punish this member, or null when they may: not themselves, not a bot, not someone at or
 * above their own highest role. Shared by warn, mute and jail.
 */
export function punishBlocker(moderator: GuildMember | null, target: GuildMember | null, targetIsBot: boolean): string | null {
    if (targetIsBot) return L("Bots can't be punished.", "ما ينعاقب بوت.");
    if (!moderator || !target) return null;
    if (moderator.id === target.id) return L("You can't punish yourself.", "ما تقدر تعاقب نفسك.");
    if (!canActOn(moderator, target)) return L("You can't punish someone whose highest role is at or above your own.", "ما تقدر تعاقب شخص رتبته أعلى من رتبتك أو تساويها.");
    return null;
}

export async function executeWarn(
    client: BotClient,
    guildId: string,
    targetId: string,
    _targetUsername: string,
    reason: string,
    reasonAr: string,
    moderatorId: string,
    member: GuildMember | null | undefined,
) {
    const { caseId } = await PunishmentRepository.createCase({
        guildId,
        userId: targetId,
        moderatorId,
        type: "warn",
        reason,
        active: true,
    });

    const newLevel = await PunishmentRepository.getPunishmentLevel(guildId, targetId);
    const levelInfo = PunishmentRepository.getLevelInfo(newLevel);

    if (member) {
        await applyLevelRole(member, levelInfo.roleId);
        if (newLevel >= MEMBER_PUNISHMENTS.tempMute.level && newLevel < MEMBER_PUNISHMENTS.tempBan.level) {
            await member.timeout(24 * 60 * 60 * 1000, `Auto-mute: punishment level ${newLevel}`).catch(() => null);
        }
        if (newLevel >= MEMBER_PUNISHMENTS.permBan.level) {
            await member.roles.add(MEMBER_PUNISHMENTS.permBan.id).catch(() => null);
        }
    }

    const user = await client.users.fetch(targetId).catch(() => null);
    if (user) {
        const lang = await getUserLang(member);
        const dmEmbed = new EmbedBuilder()
            .setTitle(t("moderation.warn_title", lang))
            .setColor(COLORS.warning)
            .setDescription(t("moderation.warn_desc", lang, { reason: lang === "ar" ? reasonAr : reason }))
            .setTimestamp();
        await user.send({ embeds: [dmEmbed] }).catch(() => null);
    }

    const shownReason = currentLang() === "ar" ? reasonAr : reason;
    const embed = new EmbedBuilder()
        .setTitle(L("⚠️ Warning given", "⚠️ تم التحذير"))
        .setColor(COLORS.warning)
        .addFields(
            { name: L("Member", "العضو"), value: `<@${targetId}>`, inline: true },
            { name: L("Moderator", "المشرف"), value: `<@${moderatorId}>`, inline: true },
            { name: L("Case", "الحالة"), value: `\`${caseId}\``, inline: true },
            { name: L("Reason", "السبب"), value: shownReason },
            { name: L("Punishment level", "مستوى العقوبة"), value: `\`${newLevel}/100\` — ${levelInfo.name}`, inline: true },
        )
        .setTimestamp();

    const moderator = await client.users.fetch(moderatorId).catch(() => null);
    await awardPunishPoints(guildId, moderatorId, moderator?.username ?? moderatorId, "warn");

    return { embed, caseId, newLevel, levelInfo };
}

export default {
    scope: "guild",
    category: "Moderation",
    data: new SlashCommandBuilder()
        .setName("warn")
        .setDescription("Manage user warnings")
        .addSubcommand(sub =>
            sub.setName("add")
                .setDescription("Issue a warning to a user")
                .addUserOption(opt => opt.setName("target").setDescription("The user to warn").setRequired(true))
                .addStringOption(opt => opt.setName("reason").setDescription("Select a reason").setRequired(true).setAutocomplete(true))
        )
        .addSubcommand(sub =>
            sub.setName("appeal")
                .setDescription("Appeal (remove) a specific warning from a user")
                .addUserOption(opt => opt.setName("target").setDescription("The user to appeal a warning for").setRequired(true))
                .addStringOption(opt => opt.setName("case").setDescription("The case ID to appeal").setRequired(true).setAutocomplete(true))
                .addStringOption(opt => opt.setName("reason").setDescription("Reason for the appeal").setRequired(true).setMaxLength(400))
        )
        .addSubcommand(sub =>
            sub.setName("list")
                .setDescription("List all warnings for a user")
                .addUserOption(opt => opt.setName("target").setDescription("The user to check").setRequired(true))
        ),

    requiredPermission: 20,

    async run(interaction: ChatInputCommandInteraction, client: BotClient) {
        const guild = interaction.guild;
        const refuse = (content: string) => interaction.reply({ content: errorText(content), flags: MessageFlags.Ephemeral });
        if (!guild) return void await refuse(L("This command can only be used in a server.", "هذا الأمر يعمل داخل السيرفر فقط."));

        const sub = interaction.options.getSubcommand();
        const target = interaction.options.getUser("target", true);
        const guildId = guild.id;
        const member = guild.members.cache.get(target.id) ?? await guild.members.fetch(target.id).catch(() => null);

        if (sub === "add") {
            const reasonKey = interaction.options.getString("reason", true);
            const modMember = interaction.member as GuildMember;

            const blocked = punishBlocker(modMember, member, target.bot);
            if (blocked) return void await refuse(blocked);

            if (await needsProof(modMember)) {
                if ((interaction as { isPrefix?: boolean }).isPrefix) {
                    const sent = await sendShortcutProofDM(client, interaction.user.id, "warn", guildId, target.id, reasonKey);
                    await interaction.reply({
                        content: sent
                            ? L("📩 Check your DMs: send the proof there to finish this warning.", "📩 شيك على الخاص: أرسل الدليل هناك عشان يكتمل التحذير.")
                            : errorText(L("I couldn't DM you for the proof (check your privacy settings). Ask a Manager+ to run it instead.", "ما قدرت أراسلك بالخاص للدليل (شيك إعدادات الخصوصية). اطلب من Manager+ ينفذه.")),
                    });
                    return;
                }
                await interaction.showModal(buildProofModal(await openProofRequest({ guildId, type: "warn", targetId: target.id, reasonKey, moderatorId: interaction.user.id }), "warn"));
                return;
            }

            await interaction.deferReply();
            const reasonDoc = await ReasonRepository.findByKey(reasonKey, guildId);
            const reason = reasonDoc?.label ?? reasonKey;
            const reasonAr = reasonDoc?.labelAr ?? reason;

            const result = await executeWarn(client, guildId, target.id, target.username, reason, reasonAr, interaction.user.id, member);
            await interaction.editReply({ embeds: [result.embed] });
            return;
        }

        if (sub === "appeal") {
            const caseId = interaction.options.getString("case", true).trim().toUpperCase();
            const reason = interaction.options.getString("reason", true);

            const punishment = await PunishmentRepository.findByCaseId(caseId, guildId);
            if (!punishment || punishment.userId !== target.id || punishment.type !== "warn") {
                return void await refuse(L("That warning case wasn't found for this member.", "ما لقيت حالة التحذير هذي لهذا العضو."));
            }
            if (punishment.appealed) return void await refuse(L("This warning was already appealed.", "هذا التحذير تم استئنافه من قبل."));

            await interaction.deferReply();
            await PunishmentRepository.appeal(caseId, guildId, reason);
            const newLevel = await PunishmentRepository.getPunishmentLevel(guildId, target.id);
            const levelInfo = PunishmentRepository.getLevelInfo(newLevel);
            if (member) await applyLevelRole(member, levelInfo.roleId);

            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(L("✅ Warning appealed", "✅ تم استئناف التحذير"))
                        .setColor(COLORS.success)
                        .addFields(
                            { name: L("Member", "العضو"), value: `<@${target.id}>`, inline: true },
                            { name: L("Case", "الحالة"), value: `\`${caseId}\``, inline: true },
                            { name: L("Appeal reason", "سبب الاستئناف"), value: reason },
                            { name: L("New punishment level", "مستوى العقوبة الجديد"), value: `\`${newLevel}/100\` — ${levelInfo.name}`, inline: true },
                        )
                        .setTimestamp(),
                ],
            });
            return;
        }

        if (sub === "list") {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const warns = await PunishmentRepository.findAllByUserAndType(target.id, guildId, "warn");
            const level = await PunishmentRepository.getPunishmentLevel(guildId, target.id);

            if (!warns.length) {
                await interaction.editReply({ content: L(`<@${target.id}> has no warnings.`, `<@${target.id}> ما عنده تحذيرات.`), allowedMentions: { parse: [] } });
                return;
            }

            const lines = warns.slice(0, 15).map((w, i) => {
                const status = w.appealed ? L("~~Appealed~~", "~~مستأنف~~") : w.active ? L("🔴 Active", "🔴 فعال") : L("⚪ Inactive", "⚪ منتهي");
                return `**${i + 1}.** \`${w.caseId}\` — ${status}\n> ${w.reason} — <t:${Math.floor(w.createdAt.getTime() / 1000)}:R>`;
            });

            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(L(`⚠️ Warnings: ${target.username}`, `⚠️ تحذيرات: ${target.username}`))
                        .setDescription(lines.join("\n\n"))
                        .setColor(COLORS.warning)
                        .setFooter({ text: L(`Punishment level ${level}/100 · ${warns.length} warning(s)`, `مستوى العقوبة ${level}/100 · ${warns.length} تحذير`) })
                        .setTimestamp(),
                ],
            });
        }
    },

    async autocomplete(interaction: AutocompleteInteraction, _client: BotClient) {
        const focused = interaction.options.getFocused(true);
        const sub = interaction.options.getSubcommand();
        const query = focused.value.toLowerCase();

        if (focused.name === "reason" && sub === "add") {
            const reasons = await ReasonRepository.findByType("warn", interaction.guildId!);
            const label = (r: { label: string; labelAr?: string }) => (currentLang() === "ar" && r.labelAr ? r.labelAr : r.label);
            const filtered = reasons
                .filter(r => r.key.includes(query) || r.label.toLowerCase().includes(query) || (r.labelAr ?? "").includes(focused.value))
                .slice(0, 25);
            await interaction.respond(filtered.map(r => ({ name: label(r).slice(0, 100), value: r.key })));
        }

        if (focused.name === "case") {
            const targetId = interaction.options.get("target")?.value as string | undefined;
            if (!targetId) return interaction.respond([]);

            const warns = await PunishmentRepository.findAllByUserAndType(targetId, interaction.guildId!, "warn");
            const filtered = warns
                .filter(w => w.active && !w.appealed)
                .filter(w => w.caseId.toLowerCase().includes(query) || w.reason.toLowerCase().includes(query))
                .slice(0, 25);

            await interaction.respond(filtered.map(w => ({ name: `${w.caseId} — ${w.reason}`.slice(0, 100), value: w.caseId })));
        }
    },
};
