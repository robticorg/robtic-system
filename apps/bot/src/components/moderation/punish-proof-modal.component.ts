import { ModalSubmitInteraction, EmbedBuilder, MessageFlags } from "discord.js";
import type { BotClient } from "@core/bot-client";
import { COLORS } from "@constants";
import { PunishRequestRepository, ReasonRepository } from "@database/repositories";
import { L, errorText, runWithLang } from "@utils";
import { getGuildLang } from "@bot/utils/lang";
import { getMemberLevel } from "@bot/utils/access";
import { parseProofCustomId, postProof, requestApproval, getOptionalUploadedFileUrl, getOptionalText } from "../../utils/moderation/punish-flow";
import { applyPunishment, type PunishmentToApply } from "@bot/utils/moderation/punish-flow/apply-request";

/**
 * The proof form, submitted (from the slash command, or from the DM button for prefix commands). The proof is posted,
 * then the punishment is applied, or sent for approval when the moderator is junior. A request is used once.
 */
export default {
    customId: /^punish_proof(:[a-f0-9]{24}|_(warn|mute|ban)_.+)$/,

    async run(interaction: ModalSubmitInteraction, client: BotClient) {
        const parsed = parseProofCustomId(interaction.customId);
        if (!parsed) return;

        let p: PunishmentToApply & { guildId: string };
        if ("requestId" in parsed) {
            const request = await PunishRequestRepository.claim(parsed.requestId, "proof", "approved", interaction.user.id);
            if (!request || request.moderatorId !== interaction.user.id) {
                await interaction.reply({ content: errorText(L("This form was already used, or has expired.", "هذا النموذج مستخدم من قبل أو انتهت صلاحيته.")), flags: MessageFlags.Ephemeral });
                return;
            }
            p = { guildId: request.guildId, type: request.type, targetId: request.targetId, reasonKey: request.reasonKey, moderatorId: request.moderatorId, extra: request.extra };
        } else {
            p = { ...parsed };
        }

        // From a DM there is no server in the event, so the server's own language is picked here.
        await runWithLang(await getGuildLang(p.guildId), async () => {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const guild = client.guilds.cache.get(p.guildId) ?? await client.guilds.fetch(p.guildId).catch(() => null);
            if (!guild) return void await interaction.editReply({ content: errorText(L("That server is no longer reachable.", "ما أقدر أوصل لهذا السيرفر.")) });

            const modMember = await guild.members.fetch(p.moderatorId).catch(() => null);
            if (!modMember) return void await interaction.editReply({ content: errorText(L("You're no longer in that server.", "أنت ما عدت موجود في السيرفر.")) });

            const proofUrl = getOptionalUploadedFileUrl(interaction.fields, "proof");
            if (proofUrl) {
                await postProof(client, guild.id, { type: p.type, targetId: p.targetId, moderatorId: p.moderatorId, note: getOptionalText(interaction.fields, "note"), attachmentUrl: proofUrl });
            }

            if ((await getMemberLevel(modMember)).score <= 20) {
                const reasonDoc = await ReasonRepository.findByKey(p.reasonKey, guild.id);
                const sent = await requestApproval({
                    guildId: guild.id, client, type: p.type, targetId: p.targetId, reasonKey: p.reasonKey, reasonLabel: reasonDoc?.label ?? p.reasonKey,
                    requesterId: p.moderatorId, extra: p.extra, proofUrl: proofUrl ?? undefined,
                });
                await interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setDescription(sent
                            ? L("⏳ Proof received. Your request was sent to a senior moderator for approval.", "⏳ وصل الدليل. تم إرسال طلبك لمشرف أعلى للموافقة.")
                            : L("❌ This server has no punishment-cases channel, so the request couldn't be sent. Ask an admin to set one on the dashboard (Logs).", "❌ ما في روم لحالات العقوبات في السيرفر، فما قدرت أرسل الطلب. اطلب من الإدارة تضبطه من لوحة التحكم (اللوقات)."))
                        .setColor(sent ? COLORS.info : COLORS.error)],
                });
                return;
            }

            await interaction.editReply({ embeds: [await applyPunishment(client, guild, p)] });
        }, p.guildId);
    },
};
