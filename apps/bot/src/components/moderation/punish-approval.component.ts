import { ButtonInteraction, EmbedBuilder, MessageFlags, type GuildMember } from "discord.js";
import type { BotClient } from "@core/bot-client";
import type { PunishType } from "@typings/punishment";
import { COLORS } from "@constants";
import { PunishRequestRepository } from "@database/repositories";
import { L, errorText } from "@utils";
import { getMemberLevel } from "@bot/utils/access";
import { applyPunishment, type PunishmentToApply } from "@bot/utils/moderation/punish-flow/apply-request";

/** Approve / Deny on a junior moderator's request: `punish_req:<id>:approve|deny`, or the old all-in-one id. */
const SAVED = /^punish_req:([a-f0-9]{24}):(approve|deny)$/;
const LEGACY = /^punish_(approve|deny)_(warn|mute|ban)_/;

/** Senior moderators (score 60+) decide. A request is claimed atomically, so two clicks can't punish twice. */
export default {
    customId: /^(punish_req:[a-f0-9]{24}:(approve|deny)|punish_(approve|deny)_(warn|mute|ban)_.+)$/,

    async run(interaction: ButtonInteraction, client: BotClient) {
        const guild = interaction.guild;
        if (!guild) return;

        if ((await getMemberLevel(interaction.member as GuildMember)).score < 60) {
            await interaction.reply({ content: errorText(L("Only senior moderators (Expert+) can approve or deny requests.", "الموافقة أو الرفض للمشرفين الكبار (Expert+) فقط.")), flags: MessageFlags.Ephemeral });
            return;
        }

        let action: string;
        let request: PunishmentToApply;
        const saved = SAVED.exec(interaction.customId);
        if (saved) {
            action = saved[2]!;
            const claimed = await PunishRequestRepository.claim(saved[1]!, "pending", action === "approve" ? "approved" : "denied", interaction.user.id);
            if (!claimed || claimed.guildId !== guild.id) {
                await interaction.reply({ content: errorText(L("This request was already handled.", "هذا الطلب تم التعامل معه من قبل.")), flags: MessageFlags.Ephemeral });
                return;
            }
            request = { type: claimed.type, targetId: claimed.targetId, reasonKey: claimed.reasonKey, moderatorId: claimed.moderatorId, extra: claimed.extra };
        } else {
            // Buttons posted before requests were saved: `punish_<action>_<type>_<target>_<reason>_<requester>[_<extra>]`.
            const parts = interaction.customId.split("_");
            if (!LEGACY.test(interaction.customId) || parts.length < 6) return;
            action = parts[1]!;
            request = { type: parts[2] as PunishType, targetId: parts[3]!, reasonKey: parts[4]!, moderatorId: parts[5]!, extra: parts[6] ?? "none" };
        }

        await interaction.deferUpdate();

        if (action === "deny") {
            const denied = new EmbedBuilder()
                .setTitle(L("❌ Request denied", "❌ تم رفض الطلب"))
                .setColor(COLORS.error)
                .setDescription(L(
                    `<@${interaction.user.id}> denied <@${request.moderatorId}>'s ${request.type} request against <@${request.targetId}>.`,
                    `<@${interaction.user.id}> رفض طلب ${request.type} من <@${request.moderatorId}> على <@${request.targetId}>.`,
                ))
                .setTimestamp();
            await interaction.editReply({ embeds: [denied], components: [] });
            return;
        }

        const embed = await applyPunishment(client, guild, request);
        embed.setFooter({ text: L(`Approved by ${interaction.user.username}`, `وافق عليه ${interaction.user.username}`) });
        await interaction.editReply({ embeds: [embed], components: [] });
    },
};
