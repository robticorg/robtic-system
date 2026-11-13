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
import { needsProof, buildProofModal, openProofRequest, sendShortcutProofDM, awardPunishPoints } from "@bot/utils/moderation/punish-flow";
import { punishBlocker } from "./warn.command";

/** Discord's timeout ceiling is 28 days. */
export const MUTE_MAX_HOURS = 28 * 24;
const DEFAULT_HOURS = 24;

/** Swaps the member's punishment-step role for the one their level now reaches. */
async function applyLevelRole(member: GuildMember, roleId: string | null): Promise<void> {
    const ladder = new Set<string>(Object.values(MEMBER_PUNISHMENTS).map(p => p.id));
    for (const [, role] of member.roles.cache.filter(r => ladder.has(r.id))) await member.roles.remove(role).catch(() => null);
    if (roleId) await member.roles.add(roleId).catch(() => null);
}

export async function executeMute(
    client: BotClient,
    guildId: string,
    targetId: string,
    _targetUsername: string,
    reason: string,
    reasonAr: string,
    moderatorId: string,
    member: GuildMember | null | undefined,
    durationMs: number,
) {
    const expiresAt = new Date(Date.now() + durationMs);
    const { caseId } = await PunishmentRepository.createCase({
        guildId,
        userId: targetId,
        moderatorId,
        type: "mute",
        reason,
        duration: durationMs,
        expiresAt,
        active: true,
    });

    const newLevel = await PunishmentRepository.getPunishmentLevel(guildId, targetId);
    const levelInfo = PunishmentRepository.getLevelInfo(newLevel);

    let timedOut = false;
    if (member) {
        await applyLevelRole(member, levelInfo.roleId);
        timedOut = await member.timeout(durationMs, `Mute: ${reason}`.slice(0, 512)).then(() => true, () => false);
        if (newLevel >= MEMBER_PUNISHMENTS.permBan.level) await member.roles.add(MEMBER_PUNISHMENTS.permBan.id).catch(() => null);
    }

    const durationHours = Math.round(durationMs / 3_600_000);

    const user = await client.users.fetch(targetId).catch(() => null);
    if (user) {
        const lang = await getUserLang(member);
        const dmEmbed = new EmbedBuilder()
            .setTitle(t("moderation.mute_title", lang))
            .setColor(COLORS.moderation)
            .setDescription(t("moderation.mute_desc", lang, { reason: lang === "ar" ? reasonAr : reason, duration: String(durationHours) }))
            .setTimestamp();
        await user.send({ embeds: [dmEmbed] }).catch(() => null);
    }

    const logEmbed = new EmbedBuilder()
        .setTitle(L("🔇 Member muted", "🔇 تم إعطاء ميوت"))
        .setColor(COLORS.moderation)
        .addFields(
            { name: L("Member", "العضو"), value: `<@${targetId}>`, inline: true },
            { name: L("Moderator", "المشرف"), value: `<@${moderatorId}>`, inline: true },
            { name: L("Case", "الحالة"), value: `\`${caseId}\``, inline: true },
            { name: L("Reason", "السبب"), value: currentLang() === "ar" ? reasonAr : reason },
            { name: L("Duration", "المدة"), value: L(`${durationHours} hour(s)`, `${durationHours} ساعة`), inline: true },
            { name: L("Ends", "ينتهي"), value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`, inline: true },
            { name: L("Punishment level", "مستوى العقوبة"), value: `\`${newLevel}/100\` — ${levelInfo.name}`, inline: true },
        )
        .setTimestamp();
    if (member && !timedOut) {
        logEmbed.setFooter({ text: L("⚠️ Discord refused the timeout. Check my role position and the Moderate Members permission.", "⚠️ رفض ديسكورد التايم أوت. تأكد من ترتيب رتبتي وصلاحية Moderate Members.") });
    }

    const noticeChannel = await getLogChannel(client, "punishments_notice", guildId) as TextChannel | null;
    if (noticeChannel) await noticeChannel.send({ embeds: [logEmbed] }).catch(() => null);

    const moderator = await client.users.fetch(moderatorId).catch(() => null);
    await awardPunishPoints(guildId, moderatorId, moderator?.username ?? moderatorId, "mute");

    return { embed: logEmbed, caseId, newLevel, levelInfo };
}

export default {
    scope: "guild",
    category: "Moderation",
    data: new SlashCommandBuilder()
        .setName("mute")
        .setDescription("Manage user mutes")
        .addSubcommand(sub =>
            sub.setName("add")
                .setDescription("Mute a user")
                .addUserOption(opt => opt.setName("target").setDescription("The user to mute").setRequired(true))
                .addStringOption(opt => opt.setName("reason").setDescription("Select a reason").setRequired(true).setAutocomplete(true))
                .addIntegerOption(opt =>
                    opt.setName("duration").setDescription(`Duration in hours (default ${DEFAULT_HOURS}, up to ${MUTE_MAX_HOURS})`).setRequired(false).setMinValue(1).setMaxValue(MUTE_MAX_HOURS)
                )
        )
        .addSubcommand(sub =>
            sub.setName("remove")
                .setDescription("Unmute a user (does NOT remove punishment level)")
                .addUserOption(opt => opt.setName("target").setDescription("The user to unmute").setRequired(true))
                .addStringOption(opt => opt.setName("case").setDescription("The case ID to remove").setRequired(true).setAutocomplete(true))
                .addStringOption(opt => opt.setName("reason").setDescription("Reason for the unmute").setRequired(true).setMaxLength(400))
        )
        .addSubcommand(sub =>
            sub.setName("appeal")
                .setDescription("Appeal a mute (removes punishment level points)")
                .addUserOption(opt => opt.setName("target").setDescription("The user to appeal for").setRequired(true))
                .addStringOption(opt => opt.setName("case").setDescription("The case ID to appeal").setRequired(true).setAutocomplete(true))
                .addStringOption(opt => opt.setName("reason").setDescription("Reason for the appeal").setRequired(true).setMaxLength(400))
        )
        .addSubcommand(sub =>
            sub.setName("list")
                .setDescription("List all mutes for a user")
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
        const notFound = L("That mute case wasn't found for this member.", "ما لقيت حالة الميوت هذي لهذا العضو.");

        if (sub === "add") {
            const reasonKey = interaction.options.getString("reason", true);
            // A prefix command skips Discord's own min/max, so the range is checked here too.
            const durationHours = interaction.options.getInteger("duration") ?? DEFAULT_HOURS;
            const modMember = interaction.member as GuildMember;

            if (!Number.isInteger(durationHours) || durationHours < 1 || durationHours > MUTE_MAX_HOURS) {
                return void await refuse(L(`The duration must be 1 to ${MUTE_MAX_HOURS} hours (Discord's limit is 28 days).`, `المدة لازم تكون من 1 إلى ${MUTE_MAX_HOURS} ساعة (حد ديسكورد 28 يوم).`));
            }
            if (!member) return void await refuse(L("That member isn't in this server.", "هذا العضو غير موجود في السيرفر."));
            const blocked = punishBlocker(modMember, member, target.bot);
            if (blocked) return void await refuse(blocked);
            if (!member.moderatable) return void await refuse(L("I can't time out that member: they're an admin or ranked above me.", "ما أقدر أعطي هذا العضو تايم أوت: هو أدمن أو رتبته فوق رتبتي."));

            if (await needsProof(modMember)) {
                if ((interaction as { isPrefix?: boolean }).isPrefix) {
                    const sent = await sendShortcutProofDM(client, interaction.user.id, "mute", guildId, target.id, reasonKey, String(durationHours));
                    await interaction.reply({
                        content: sent
                            ? L("📩 Check your DMs: send the proof there to finish this mute.", "📩 شيك على الخاص: أرسل الدليل هناك عشان يكتمل الميوت.")
                            : errorText(L("I couldn't DM you for the proof (check your privacy settings). Ask a Manager+ to run it instead.", "ما قدرت أراسلك بالخاص للدليل (شيك إعدادات الخصوصية). اطلب من Manager+ ينفذه.")),
                    });
                    return;
                }
                await interaction.showModal(buildProofModal(await openProofRequest({ guildId, type: "mute", targetId: target.id, reasonKey, moderatorId: interaction.user.id, extra: String(durationHours) }), "mute"));
                return;
            }

            await interaction.deferReply();
            const reasonDoc = await ReasonRepository.findByKey(reasonKey, guildId);
            const reason = reasonDoc?.label ?? reasonKey;
            const reasonAr = reasonDoc?.labelAr ?? reason;

            const result = await executeMute(client, guildId, target.id, target.username, reason, reasonAr, interaction.user.id, member, durationHours * 3_600_000);
            await interaction.editReply({ embeds: [result.embed] });
            return;
        }

        if (sub === "remove" || sub === "appeal") {
            const caseId = interaction.options.getString("case", true).trim().toUpperCase();
            const reason = interaction.options.getString("reason", true);
            const punishment = await PunishmentRepository.findByCaseId(caseId, guildId);
            if (!punishment || punishment.userId !== target.id || punishment.type !== "mute") return void await refuse(notFound);

            if (sub === "remove") {
                if (!punishment.active) return void await refuse(L("This mute already ended.", "هذا الميوت منتهي من قبل."));
                await interaction.deferReply();
                await PunishmentRepository.deactivate(caseId, guildId);
                if (member) await member.timeout(null, `Unmute: ${reason}`.slice(0, 512)).catch(() => null);

                const level = await PunishmentRepository.getPunishmentLevel(guildId, target.id);
                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(L("🔊 Mute removed", "🔊 تم فك الميوت"))
                            .setColor(COLORS.success)
                            .addFields(
                                { name: L("Member", "العضو"), value: `<@${target.id}>`, inline: true },
                                { name: L("Case", "الحالة"), value: `\`${caseId}\``, inline: true },
                                { name: L("Reason", "السبب"), value: reason },
                                { name: L("Punishment level", "مستوى العقوبة"), value: L(`\`${level}/100\` (unchanged)`, `\`${level}/100\` (بدون تغيير)`), inline: true },
                            )
                            .setFooter({ text: L("The level stays. Use /mute appeal to take its points back.", "المستوى ما تغير. استخدم /mute appeal لإرجاع النقاط.") })
                            .setTimestamp(),
                    ],
                });
                return;
            }

            if (punishment.appealed) return void await refuse(L("This mute was already appealed.", "هذا الميوت تم استئنافه من قبل."));
            await interaction.deferReply();
            await PunishmentRepository.appeal(caseId, guildId, reason);
            const newLevel = await PunishmentRepository.getPunishmentLevel(guildId, target.id);
            const levelInfo = PunishmentRepository.getLevelInfo(newLevel);
            if (member) {
                await member.timeout(null, `Appeal: ${reason}`.slice(0, 512)).catch(() => null);
                await applyLevelRole(member, levelInfo.roleId);
            }

            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(L("✅ Mute appealed", "✅ تم استئناف الميوت"))
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
            const mutes = await PunishmentRepository.findAllByUserAndType(target.id, guildId, "mute");
            const level = await PunishmentRepository.getPunishmentLevel(guildId, target.id);

            if (!mutes.length) {
                await interaction.editReply({ content: L(`<@${target.id}> has no mutes.`, `<@${target.id}> ما عنده ميوتات.`), allowedMentions: { parse: [] } });
                return;
            }

            const lines = mutes.slice(0, 15).map((m, i) => {
                const status = m.appealed ? L("~~Appealed~~", "~~مستأنف~~") : m.active ? L("🔴 Active", "🔴 فعال") : L("⚪ Ended", "⚪ منتهي");
                return `**${i + 1}.** \`${m.caseId}\` — ${status}\n> ${m.reason} — <t:${Math.floor(m.createdAt.getTime() / 1000)}:R>`;
            });

            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(L(`🔇 Mutes: ${target.username}`, `🔇 ميوتات: ${target.username}`))
                        .setDescription(lines.join("\n\n"))
                        .setColor(COLORS.moderation)
                        .setFooter({ text: L(`Punishment level ${level}/100 · ${mutes.length} mute(s)`, `مستوى العقوبة ${level}/100 · ${mutes.length} ميوت`) })
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
            const reasons = await ReasonRepository.findByType("mute", interaction.guildId!);
            const label = (r: { label: string; labelAr?: string }) => (currentLang() === "ar" && r.labelAr ? r.labelAr : r.label);
            const filtered = reasons
                .filter(r => r.key.includes(query) || r.label.toLowerCase().includes(query) || (r.labelAr ?? "").includes(focused.value))
                .slice(0, 25);
            await interaction.respond(filtered.map(r => ({ name: label(r).slice(0, 100), value: r.key })));
        }

        if (focused.name === "case") {
            const targetId = interaction.options.get("target")?.value as string | undefined;
            if (!targetId) return interaction.respond([]);

            const mutes = await PunishmentRepository.findAllByUserAndType(targetId, interaction.guildId!, "mute");
            const filtered = mutes
                .filter(m => !m.appealed)
                .filter(m => m.caseId.toLowerCase().includes(query) || m.reason.toLowerCase().includes(query))
                .slice(0, 25);

            await interaction.respond(filtered.map(m => ({ name: `${m.caseId} — ${m.reason}`.slice(0, 100), value: m.caseId })));
        }
    },
};
