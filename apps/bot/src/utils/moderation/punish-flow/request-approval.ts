import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type TextChannel } from "discord.js";
import type { BotClient } from "@core/bot-client";
import type { PunishType } from "@typings/punishment";
import { COLORS, PUNISH_TITLES, PUNISH_APPROVAL_MESSAGES, PUNISH_EXTRA_NONE } from "@constants";
import { PunishRequestRepository } from "@database/repositories";
import { getLogChannel } from "@bot/utils/server-log";

interface ApprovalParams {
    client: BotClient;
    type: PunishType;
    targetId: string;
    reasonKey: string;
    reasonLabel: string;
    requesterId: string;
    /** The server the punishment is in; the request goes to its punishment-cases channel. */
    guildId: string;
    extra?: string;
    proofUrl?: string;
}

/** The Approve / Deny buttons for a saved request: `punish_req:<id>:approve|deny`. */
export const approvalCustomId = (requestId: string, action: "approve" | "deny") => `punish_req:${requestId}:${action}`;

/**
 * A junior moderator's punishment, sent to the server's punishment-cases channel for a senior to approve or deny.
 * Returns false when the server has no such channel, so the caller can say so instead of pretending it was sent.
 */
export async function requestApproval(params: ApprovalParams): Promise<boolean> {
    const { client, type, targetId, reasonKey, reasonLabel, requesterId, guildId, extra, proofUrl } = params;

    const approvalChannel = await getLogChannel(client, "punishments_case", guildId) as TextChannel | null;
    if (!approvalChannel) return false;

    const requestId = await PunishRequestRepository.create({
        guildId, type, targetId, reasonKey, moderatorId: requesterId, extra: extra ?? PUNISH_EXTRA_NONE, proofUrl: proofUrl ?? null, status: "pending",
    });

    const embed = new EmbedBuilder()
        .setTitle(PUNISH_APPROVAL_MESSAGES.title(PUNISH_TITLES[type]))
        .setColor(type === "warn" ? COLORS.warning : COLORS.moderation)
        .addFields(
            { name: PUNISH_APPROVAL_MESSAGES.targetFieldName, value: `<@${targetId}>`, inline: true },
            { name: PUNISH_APPROVAL_MESSAGES.requestedByFieldName, value: `<@${requesterId}>`, inline: true },
            { name: PUNISH_APPROVAL_MESSAGES.reasonFieldName, value: reasonLabel.slice(0, 1024) || "—" },
        )
        .setTimestamp();

    if (extra && extra !== PUNISH_EXTRA_NONE) {
        if (type === "mute") embed.addFields({ name: PUNISH_APPROVAL_MESSAGES.durationFieldName, value: PUNISH_APPROVAL_MESSAGES.durationValue(extra), inline: true });
        if (type === "ban") {
            embed.addFields({
                name: PUNISH_APPROVAL_MESSAGES.typeFieldName,
                value: extra === "perm" ? PUNISH_APPROVAL_MESSAGES.permanentBanValue : PUNISH_APPROVAL_MESSAGES.tempBanValue(extra),
                inline: true,
            });
        }
    }
    if (proofUrl) embed.setImage(proofUrl);

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(approvalCustomId(requestId, "approve")).setLabel(PUNISH_APPROVAL_MESSAGES.approveLabel).setStyle(ButtonStyle.Success).setEmoji(PUNISH_APPROVAL_MESSAGES.approveEmoji),
        new ButtonBuilder().setCustomId(approvalCustomId(requestId, "deny")).setLabel(PUNISH_APPROVAL_MESSAGES.denyLabel).setStyle(ButtonStyle.Danger).setEmoji(PUNISH_APPROVAL_MESSAGES.denyEmoji),
    );

    const sent = await approvalChannel.send({ embeds: [embed], components: [buttons] }).catch(() => null);
    return Boolean(sent);
}
