import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    AutocompleteInteraction,
    EmbedBuilder,
    MessageFlags,
    type GuildMember,
    type TextChannel,
} from "discord.js";
import type { BotClient } from "@core/bot-client";
import { COLORS, MEMBER_PUNISHMENTS } from "@constants";
import { PunishmentRepository, ReasonRepository } from "@database/repositories";
import { L, currentLang, errorText } from "@utils";
import { getUserLang, t } from "@bot/utils/lang";
import { getLogChannel } from "@bot/utils/server-log";
import { recordSecurityEvent } from "@bot/utils/moderation/security";
import { needsProof, buildProofModal, openProofRequest, sendShortcutProofDM } from "@bot/utils/moderation/punish-flow";
import { punishBlocker } from "./warn.command";

const DEFAULT_DAYS = 7;
export const JAIL_MAX_DAYS = 365;
/** Discord's timeout ceiling; a longer jail still expires on its own date (the case's expiresAt). */
const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;

/** Swaps the member's punishment-step role for the one their level now reaches. */
async function applyLevelRole(member: GuildMember, roleId: string | null): Promise<void> {
    const ladder = new Set<string>(Object.values(MEMBER_PUNISHMENTS).map(p => p.id));
    for (const [, role] of member.roles.cache.filter(r => ladder.has(r.id))) await member.roles.remove(role).catch(() => null);
    if (roleId) await member.roles.add(roleId).catch(() => null);
}

/**
 * The punishment-system jail: a case record, punishment-level points, punishment roles, a DM, and a
 * Discord timeout for the temporary form. It never touches the guild's actual ban list — `/ban`
 * does that. The stored punishment `type` is still "ban"/"tempban" because that is what every
 * existing case record, reason and appeal in the database is keyed on.
 */
export async function executeBan(
    client: BotClient,
    guildId: string,
    targetId: string,
    _targetUsername: string,
    reason: string,
    reasonAr: string,
    moderatorId: string,
    member: GuildMember | null | undefined,
    permanent: boolean,
    durationDays: number,
    guild: ChatInputCommandInteraction["guild"],
) {
    const type = permanent ? "ban" : "tempban";
    const durationMs = permanent ? null : durationDays * 24 * 60 * 60 * 1000;
    const expiresAt = permanent ? null : new Date(Date.now() + durationMs!);

    const { caseId } = await PunishmentRepository.createCase({
        guildId,
        userId: targetId,
        moderatorId,
        type,
        reason,
        duration: durationMs,
        expiresAt,
        active: true,
    });

    const newLevel = await PunishmentRepository.getPunishmentLevel(guildId, targetId);
    const levelInfo = PunishmentRepository.getLevelInfo(newLevel);

    let timeoutRefused = false;
    if (member) {
        await applyLevelRole(member, levelInfo.roleId);
        if (permanent) await member.roles.add(MEMBER_PUNISHMENTS.permBan.id).catch(() => null);
        else timeoutRefused = !(await member.timeout(Math.min(durationMs!, MAX_TIMEOUT_MS), `Jail: ${reason}`.slice(0, 512)).then(() => true, () => false));
    }

    const user = await client.users.fetch(targetId).catch(() => null);
    if (user) {
        const lang = await getUserLang(member);
        const localReason = lang === "ar" ? reasonAr : reason;
        const dmEmbed = new EmbedBuilder()
            .setTitle(permanent ? t("moderation.ban_title_perm", lang) : t("moderation.ban_title_temp", lang))
            .setColor(COLORS.moderation)
            .setDescription(
                permanent
                    ? t("moderation.ban_desc_perm", lang, { reason: localReason })
                    : t("moderation.ban_desc_temp", lang, { reason: localReason, duration: String(durationDays) }),
            )
            .setTimestamp();
        await user.send({ embeds: [dmEmbed] }).catch(() => null);
    }

    const logEmbed = new EmbedBuilder()
        .setTitle(permanent ? L("🔒 Permanent jail", "🔒 سجن دائم") : L("🔒 Temporary jail", "🔒 سجن مؤقت"))
        .setColor(COLORS.moderation)
        .addFields(
            { name: L("Member", "العضو"), value: `<@${targetId}>`, inline: true },
            { name: L("Moderator", "المشرف"), value: `<@${moderatorId}>`, inline: true },
            { name: L("Case", "الحالة"), value: `\`${caseId}\``, inline: true },
            { name: L("Reason", "السبب"), value: currentLang() === "ar" ? reasonAr : reason },
            { name: L("Type", "النوع"), value: permanent ? L("Permanent", "دائم") : L(`Temporary (${durationDays} day(s))`, `مؤقت (${durationDays} يوم)`), inline: true },
            ...(expiresAt ? [{ name: L("Ends", "ينتهي"), value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`, inline: true }] : []),
            { name: L("Punishment level", "مستوى العقوبة"), value: `\`${newLevel}/100\` — ${levelInfo.name}`, inline: true },
        )
        .setTimestamp();
    if (timeoutRefused) {
        logEmbed.setFooter({ text: L("⚠️ Discord refused the timeout. Check my role position and the Moderate Members permission.", "⚠️ رفض ديسكورد التايم أوت. تأكد من ترتيب رتبتي وصلاحية Moderate Members.") });
    }

    const noticeChannel = await getLogChannel(client, "punishments_notice", guildId) as TextChannel | null;
    if (noticeChannel) await noticeChannel.send({ embeds: [logEmbed] }).catch(() => null);

    if (guild) {
        await recordSecurityEvent({ client, guild, event: "ban", executorId: moderatorId, targetId, source: "command:/jail", details: reason });
    }

    return { embed: logEmbed, caseId, newLevel, levelInfo };
}

const isJail = (type: string) => type === "ban" || type === "tempban";

export default {
    scope: "guild",
    category: "Moderation",
    data: new SlashCommandBuilder()
        .setName("jail")
        .setDescription("Manage jail punishments (case record, punishment level, timeout)")
        .addSubcommand(sub =>
            sub.setName("add")
                .setDescription("Jail a user")
                .addUserOption(opt => opt.setName("target").setDescription("The user to jail").setRequired(true))
                .addStringOption(opt => opt.setName("reason").setDescription("Select a reason").setRequired(true).setAutocomplete(true))
                .addBooleanOption(opt => opt.setName("permanent").setDescription("Permanent jail? (default: false)").setRequired(false))
                .addIntegerOption(opt =>
                    opt.setName("duration").setDescription(`Days for a temporary jail (default ${DEFAULT_DAYS}, up to ${JAIL_MAX_DAYS})`).setRequired(false).setMinValue(1).setMaxValue(JAIL_MAX_DAYS)
                )
        )
        .addSubcommand(sub =>
            sub.setName("remove")
                .setDescription("Release a user (does NOT remove punishment level)")
                .addUserOption(opt => opt.setName("target").setDescription("The user to release").setRequired(true))
                .addStringOption(opt => opt.setName("case").setDescription("The case ID to remove").setRequired(true).setAutocomplete(true))
                .addStringOption(opt => opt.setName("reason").setDescription("Reason for the release").setRequired(true).setMaxLength(400))
        )
        .addSubcommand(sub =>
            sub.setName("appeal")
                .setDescription("Appeal a jail (removes punishment level points)")
                .addUserOption(opt => opt.setName("target").setDescription("The user to appeal for").setRequired(true))
                .addStringOption(opt => opt.setName("case").setDescription("The case ID to appeal").setRequired(true).setAutocomplete(true))
                .addStringOption(opt => opt.setName("reason").setDescription("Reason for the appeal").setRequired(true).setMaxLength(400))
        )
        .addSubcommand(sub =>
            sub.setName("list")
                .setDescription("List all jail cases for a user")
                .addUserOption(opt => opt.setName("target").setDescription("The user to check").setRequired(true))
        ),

    requiredPermission: 60,

    async run(interaction: ChatInputCommandInteraction, client: BotClient) {
        const guild = interaction.guild;
        const refuse = (content: string) => interaction.reply({ content: errorText(content), flags: MessageFlags.Ephemeral });
        if (!guild) return void await refuse(L("This command can only be used in a server.", "هذا الأمر يعمل داخل السيرفر فقط."));

        const sub = interaction.options.getSubcommand();
        const target = interaction.options.getUser("target", true);
        const guildId = guild.id;
        const member = guild.members.cache.get(target.id) ?? await guild.members.fetch(target.id).catch(() => null);
        const notFound = L("That jail case wasn't found for this member.", "ما لقيت حالة السجن هذي لهذا العضو.");

        if (sub === "add") {
            const reasonKey = interaction.options.getString("reason", true);
            const permanent = interaction.options.getBoolean("permanent") ?? false;
            const durationDays = interaction.options.getInteger("duration") ?? DEFAULT_DAYS;
            const modMember = interaction.member as GuildMember;
            const extra = permanent ? "perm" : String(durationDays);

            if (!permanent && (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > JAIL_MAX_DAYS)) {
                return void await refuse(L(`The duration must be 1 to ${JAIL_MAX_DAYS} days.`, `المدة لازم تكون من 1 إلى ${JAIL_MAX_DAYS} يوم.`));
            }
            const blocked = punishBlocker(modMember, member, target.bot);
            if (blocked) return void await refuse(blocked);

            if (await needsProof(modMember)) {
                if ((interaction as { isPrefix?: boolean }).isPrefix) {
                    const sent = await sendShortcutProofDM(client, interaction.user.id, "ban", guildId, target.id, reasonKey, extra);
                    await interaction.reply({
                        content: sent
                            ? L("📩 Check your DMs: send the proof there to finish this jail.", "📩 شيك على الخاص: أرسل الدليل هناك عشان يكتمل السجن.")
                            : errorText(L("I couldn't DM you for the proof (check your privacy settings). Ask a Manager+ to run it instead.", "ما قدرت أراسلك بالخاص للدليل (شيك إعدادات الخصوصية). اطلب من Manager+ ينفذه.")),
                    });
                    return;
                }
                await interaction.showModal(buildProofModal(await openProofRequest({ guildId, type: "ban", targetId: target.id, reasonKey, moderatorId: interaction.user.id, extra }), "ban"));
                return;
            }

            await interaction.deferReply();
            const reasonDoc = await ReasonRepository.findByKey(reasonKey, guildId);
            const reason = reasonDoc?.label ?? reasonKey;
            const reasonAr = reasonDoc?.labelAr ?? reason;

            const result = await executeBan(client, guildId, target.id, target.username, reason, reasonAr, interaction.user.id, member, permanent, durationDays, guild);
            await interaction.editReply({ embeds: [result.embed] });
            return;
        }

        if (sub === "remove" || sub === "appeal") {
            const caseId = interaction.options.getString("case", true).trim().toUpperCase();
            const reason = interaction.options.getString("reason", true);
            const punishment = await PunishmentRepository.findByCaseId(caseId, guildId);
            if (!punishment || punishment.userId !== target.id || !isJail(punishment.type)) return void await refuse(notFound);

            if (sub === "remove") {
                if (!punishment.active) return void await refuse(L("This jail already ended.", "هذا السجن منتهي من قبل."));
                await interaction.deferReply();
                await PunishmentRepository.deactivate(caseId, guildId);
                if (member) {
                    await member.roles.remove(MEMBER_PUNISHMENTS.permBan.id).catch(() => null);
                    await member.timeout(null, `Release: ${reason}`.slice(0, 512)).catch(() => null);
                }

                const level = await PunishmentRepository.getPunishmentLevel(guildId, target.id);
                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(L("✅ Member released", "✅ تم إطلاق العضو"))
                            .setColor(COLORS.success)
                            .addFields(
                                { name: L("Member", "العضو"), value: `<@${target.id}>`, inline: true },
                                { name: L("Case", "الحالة"), value: `\`${caseId}\``, inline: true },
                                { name: L("Reason", "السبب"), value: reason },
                                { name: L("Punishment level", "مستوى العقوبة"), value: L(`\`${level}/100\` (unchanged)`, `\`${level}/100\` (بدون تغيير)`), inline: true },
                            )
                            .setFooter({ text: L("The level stays. Use /jail appeal to take its points back.", "المستوى ما تغير. استخدم /jail appeal لإرجاع النقاط.") })
                            .setTimestamp(),
                    ],
                });
                return;
            }

            if (punishment.appealed) return void await refuse(L("This jail was already appealed.", "هذا السجن تم استئنافه من قبل."));
            await interaction.deferReply();
            await PunishmentRepository.appeal(caseId, guildId, reason);
            const newLevel = await PunishmentRepository.getPunishmentLevel(guildId, target.id);
            const levelInfo = PunishmentRepository.getLevelInfo(newLevel);
            if (member) {
                await member.roles.remove(MEMBER_PUNISHMENTS.permBan.id).catch(() => null);
                await member.timeout(null, `Appeal: ${reason}`.slice(0, 512)).catch(() => null);
                await applyLevelRole(member, levelInfo.roleId);
            }

            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(L("✅ Jail appealed", "✅ تم استئناف السجن"))
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
            const records = (await PunishmentRepository.findByUser(target.id, guildId)).filter(p => isJail(p.type));
            const level = await PunishmentRepository.getPunishmentLevel(guildId, target.id);

            if (!records.length) {
                await interaction.editReply({ content: L(`<@${target.id}> has no jail cases.`, `<@${target.id}> ما عنده حالات سجن.`), allowedMentions: { parse: [] } });
                return;
            }

            const lines = records.slice(0, 15).map((b, i) => {
                const status = b.appealed ? L("~~Appealed~~", "~~مستأنف~~") : b.active ? L("🔴 Active", "🔴 فعال") : L("⚪ Ended", "⚪ منتهي");
                const kind = b.type === "ban" ? L("Permanent", "دائم") : L("Temporary", "مؤقت");
                return `**${i + 1}.** \`${b.caseId}\` [${kind}] — ${status}\n> ${b.reason} — <t:${Math.floor(b.createdAt.getTime() / 1000)}:R>`;
            });

            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(L(`🔒 Jail cases: ${target.username}`, `🔒 حالات السجن: ${target.username}`))
                        .setDescription(lines.join("\n\n"))
                        .setColor(COLORS.moderation)
                        .setFooter({ text: L(`Punishment level ${level}/100 · ${records.length} case(s)`, `مستوى العقوبة ${level}/100 · ${records.length} حالة`) })
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
            const reasons = await ReasonRepository.findByType("ban", interaction.guildId!);
            const label = (r: { label: string; labelAr?: string }) => (currentLang() === "ar" && r.labelAr ? r.labelAr : r.label);
            const filtered = reasons
                .filter(r => r.key.includes(query) || r.label.toLowerCase().includes(query) || (r.labelAr ?? "").includes(focused.value))
                .slice(0, 25);
            await interaction.respond(filtered.map(r => ({ name: label(r).slice(0, 100), value: r.key })));
        }

        if (focused.name === "case") {
            const targetId = interaction.options.get("target")?.value as string | undefined;
            if (!targetId) return interaction.respond([]);

            const records = (await PunishmentRepository.findByUser(targetId, interaction.guildId!)).filter(b => isJail(b.type) && !b.appealed);
            const filtered = records
                .filter(b => b.caseId.toLowerCase().includes(query) || b.reason.toLowerCase().includes(query))
                .slice(0, 25);

            await interaction.respond(filtered.map(b => ({ name: `${b.caseId} — ${b.reason}`.slice(0, 100), value: b.caseId })));
        }
    },
};
