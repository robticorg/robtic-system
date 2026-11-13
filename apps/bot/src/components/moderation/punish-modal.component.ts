import { ModalSubmitInteraction, EmbedBuilder, MessageFlags, type GuildMember } from "discord.js";
import type { BotClient } from "@core/bot-client";
import type { ComponentHandler } from "@typings/command";
import { COLORS } from "@constants";
import { ReasonRepository } from "@database/repositories";
import { L, errorText } from "@utils";
import { getMemberLevel } from "@bot/utils/access";
import { executeWarn, punishBlocker } from "@bot/commands/guild/admin/moderation/warn.command";
import { executeMute, MUTE_MAX_HOURS } from "@bot/commands/guild/admin/moderation/mute.command";
import { executeBan, JAIL_MAX_DAYS } from "@bot/commands/guild/admin/moderation/jail.command";
import { requestApproval, postProof, getOptionalUploadedFileUrl, getOptionalText } from "../../utils/moderation/punish-flow";
import { parseJailLength, parseMuteHours } from "../../utils/moderation/punish-flow/punish-form";

const CUSTOM_ID = /^punish_modal_(warn|mute|ban)_(\d+)$/;

/**
 * The right-click punish form, submitted. Everything is checked again here (the form may have sat open while roles
 * changed), the length is validated, proof is posted, and a junior moderator's punishment goes for approval instead of
 * being applied.
 */
export const punishModalHandler: ComponentHandler<ModalSubmitInteraction> = {
    customId: CUSTOM_ID,

    async run(interaction: ModalSubmitInteraction, client: BotClient) {
        const parts = interaction.customId.match(CUSTOM_ID);
        if (!parts || !interaction.guild) return;

        const type = parts[1] as "warn" | "mute" | "ban";
        const targetId = parts[2]!;
        const guild = interaction.guild;
        const guildId = guild.id;
        const modMember = interaction.member as GuildMember;
        const refuse = (content: string) => interaction.reply({ content: errorText(content), flags: MessageFlags.Ephemeral });

        const targetUser = await client.users.fetch(targetId).catch(() => null);
        if (!targetUser) return void await refuse(L("That user wasn't found.", "ما لقيت هذا الشخص."));
        const targetMember = guild.members.cache.get(targetId) ?? await guild.members.fetch(targetId).catch(() => null);

        const blocked = punishBlocker(modMember, targetMember, targetUser.bot);
        if (blocked) return void await refuse(blocked);

        // The length, validated before anything is recorded.
        let muteHours = 24;
        let jail: { permanent: boolean; days: number } = { permanent: true, days: 0 };
        const lengthText = getOptionalText(interaction.fields, "duration");
        if (type === "mute") {
            const hours = parseMuteHours(lengthText);
            if (hours === null) return void await refuse(L(`Hours must be a whole number from 1 to ${MUTE_MAX_HOURS}.`, `الساعات لازم تكون رقم صحيح من 1 إلى ${MUTE_MAX_HOURS}.`));
            if (!targetMember) return void await refuse(L("That member isn't in this server.", "هذا العضو غير موجود في السيرفر."));
            if (!targetMember.moderatable) return void await refuse(L("I can't time out that member: they're an admin or ranked above me.", "ما أقدر أعطي هذا العضو تايم أوت: هو أدمن أو رتبته فوق رتبتي."));
            muteHours = hours;
        }
        if (type === "ban") {
            const length = parseJailLength(lengthText);
            if (!length) return void await refuse(L(`The length must be "perm" or 1 to ${JAIL_MAX_DAYS} days.`, `المدة لازم تكون "perm" أو "دائم"، أو من 1 إلى ${JAIL_MAX_DAYS} يوم.`));
            jail = length.permanent ? { permanent: true, days: 0 } : { permanent: false, days: length.days };
        }

        await interaction.deferReply();

        const reasonRaw = getOptionalText(interaction.fields, "reason").trim();
        const reasonDoc = await ReasonRepository.findByKey(reasonRaw.toLowerCase(), guildId);
        const reasonKey = reasonDoc?.key ?? reasonRaw;
        const reason = reasonDoc?.label ?? reasonRaw;
        const reasonAr = reasonDoc?.labelAr ?? reasonRaw;

        const proofUrl = getOptionalUploadedFileUrl(interaction.fields, "proof");
        if (proofUrl) {
            await postProof(client, guildId, { type, targetId, moderatorId: interaction.user.id, note: getOptionalText(interaction.fields, "note"), attachmentUrl: proofUrl });
        }

        // Junior moderators (score 20 and below) ask a senior instead of punishing directly.
        if ((await getMemberLevel(modMember)).score <= 20) {
            const extra = type === "mute" ? String(muteHours) : type === "ban" ? (jail.permanent ? "perm" : String(jail.days)) : undefined;
            const sent = await requestApproval({
                guildId, client, type, targetId, reasonKey, reasonLabel: reason,
                requesterId: interaction.user.id, extra, proofUrl: proofUrl ?? undefined,
            });
            await interaction.deleteReply().catch(() => {});
            await interaction.followUp({
                embeds: [new EmbedBuilder()
                    .setDescription(sent
                        ? L("⏳ Your request was sent to a senior moderator for approval.", "⏳ تم إرسال طلبك لمشرف أعلى للموافقة.")
                        : L("❌ This server has no punishment-cases channel, so the request couldn't be sent. Ask an admin to set one on the dashboard (Logs).", "❌ ما في روم لحالات العقوبات في السيرفر، فما قدرت أرسل الطلب. اطلب من الإدارة تضبطه من لوحة التحكم (اللوقات)."))
                    .setColor(sent ? COLORS.info : COLORS.error)],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const result = type === "warn"
            ? await executeWarn(client, guildId, targetId, targetUser.username, reason, reasonAr, interaction.user.id, targetMember)
            : type === "mute"
                ? await executeMute(client, guildId, targetId, targetUser.username, reason, reasonAr, interaction.user.id, targetMember, muteHours * 3_600_000)
                : await executeBan(client, guildId, targetId, targetUser.username, reason, reasonAr, interaction.user.id, targetMember, jail.permanent, jail.days, guild);
        await interaction.editReply({ embeds: [result.embed] });
    },
};
