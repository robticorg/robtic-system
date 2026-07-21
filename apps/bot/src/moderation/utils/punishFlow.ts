import {
    ModalBuilder,
    LabelBuilder,
    TextInputBuilder,
    TextInputStyle,
    FileUploadBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    type ModalSubmitFields,
    type GuildMember,
    type TextChannel,
} from "discord.js";
import type { BotClient } from "@core/BotClient";
import { Colors } from "@core/config";
import { PunishConfigRepository, ActivityRepository } from "@database/repositories";
import { isAnyManager } from "@shared/utils/access";
import { getLogChannel } from "@shared/utils/getLogChannel";

export type PunishType = "warn" | "mute" | "ban";

/** discord.js throws if customId wasn't part of the submitted modal — the two modal variants don't always share fields. */
export function getOptionalUploadedFileUrl(fields: ModalSubmitFields, customId: string): string | null {
    try {
        return fields.getUploadedFiles(customId, false)?.first()?.url ?? null;
    } catch {
        return null;
    }
}

export function getOptionalText(fields: ModalSubmitFields, customId: string): string {
    try {
        return fields.getTextInputValue(customId);
    } catch {
        return "";
    }
}

/** Manager+ (and full-power) are exempt from the proof-of-evidence requirement. */
export async function needsProof(member: GuildMember): Promise<boolean> {
    return !(await isAnyManager(member));
}

const TITLES: Record<PunishType, string> = {
    warn: "⚠️ Warning",
    mute: "🔇 Mute",
    ban: "🔨 Ban",
};

// Kept short — a Discord customId caps at 100 chars and this packs five IDs/slugs into one string.
export function proofModalCustomId(type: PunishType, guildId: string, targetId: string, reasonKey: string, moderatorId: string, extra = "none"): string {
    return `punish_proof_${type}_${guildId}_${targetId}_${reasonKey}_${moderatorId}_${extra}`;
}

export function parseProofCustomId(customId: string): { type: PunishType; guildId: string; targetId: string; reasonKey: string; moderatorId: string; extra: string } | null {
    const parts = customId.split("_");
    if (parts.length < 8) return null;
    const [, , type, guildId, targetId, reasonKey, moderatorId, extra] = parts;
    return { type: type as PunishType, guildId, targetId, reasonKey, moderatorId, extra: extra ?? "none" };
}

/** `guildId` is embedded since this modal can also be shown from a DM button (no guild context there). */
export function buildProofModal(type: PunishType, guildId: string, targetId: string, reasonKey: string, moderatorId: string, extra = "none"): ModalBuilder {
    const modal = new ModalBuilder()
        .setCustomId(proofModalCustomId(type, guildId, targetId, reasonKey, moderatorId, extra))
        .setTitle(`${TITLES[type]} — Proof Required`);

    const noteLabel = new LabelBuilder()
        .setLabel("Proof note")
        .setDescription("Optional context for the evidence you're attaching")
        .setTextInputComponent(
            new TextInputBuilder()
                .setCustomId("note")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setMaxLength(300)
        );

    const fileLabel = new LabelBuilder()
        .setLabel("Proof image")
        .setDescription("Attach a screenshot/image showing the reason for this action")
        .setFileUploadComponent(
            new FileUploadBuilder()
                .setCustomId("proof")
                .setMinValues(1)
                .setMaxValues(1)
                .setRequired(true)
        );

    modal.addLabelComponents(noteLabel, fileLabel);
    return modal;
}

interface ApprovalParams {
    client: BotClient;
    type: PunishType;
    targetId: string;
    reasonKey: string;
    reasonLabel: string;
    requesterId: string;
    extra?: string;
    proofUrl?: string;
}

/** Shared senior-approval request (score <= 20 band), posted to punishments_case with the approve/deny buttons. */
export async function requestApproval(params: ApprovalParams): Promise<void> {
    const { client, type, targetId, reasonKey, reasonLabel, requesterId, extra, proofUrl } = params;

    const embed = new EmbedBuilder()
        .setTitle(`${TITLES[type]} Approval Required`)
        .setColor(type === "warn" ? Colors.warning : Colors.moderation)
        .addFields(
            { name: "Target", value: `<@${targetId}>`, inline: true },
            { name: "Requested By", value: `<@${requesterId}>`, inline: true },
            { name: "Reason", value: reasonLabel },
        )
        .setTimestamp();

    if (extra && extra !== "none") {
        if (type === "mute") embed.addFields({ name: "Duration", value: `${extra} hour(s)`, inline: true });
        if (type === "ban") embed.addFields({ name: "Type", value: extra === "perm" ? "Permanent Ban" : `Temp Ban (${extra} day(s))`, inline: true });
    }

    if (proofUrl) embed.setImage(proofUrl);

    const customIdExtra = extra && extra !== "none" ? `_${extra}` : "";
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`punish_approve_${type}_${targetId}_${reasonKey}_${requesterId}${customIdExtra}`)
            .setLabel("Approve")
            .setStyle(ButtonStyle.Success)
            .setEmoji("✅"),
        new ButtonBuilder()
            .setCustomId(`punish_deny_${type}_${targetId}_${reasonKey}_${requesterId}`)
            .setLabel("Deny")
            .setStyle(ButtonStyle.Danger)
            .setEmoji("❌"),
    );

    const approvalChannel = await getLogChannel(client, "punishments_case") as TextChannel | null;
    if (approvalChannel) {
        await approvalChannel.send({ embeds: [embed], components: [buttons] });
    }
}

interface ProofParams {
    type: PunishType;
    targetId: string;
    moderatorId: string;
    note: string;
    attachmentUrl: string;
}

/** Posts evidence to the configured proof channel — separate from punishments_notice. Silently no-ops if unset, matching getLogChannel's convention. */
export async function postProof(client: BotClient, guildId: string, params: ProofParams): Promise<void> {
    const config = await PunishConfigRepository.getCached(guildId);
    if (!config.proofChannelId) return;

    const channel = client.channels.cache.get(config.proofChannelId) as TextChannel | undefined;
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setTitle(`${TITLES[params.type]} — Proof Submitted`)
        .setColor(Colors.info)
        .addFields(
            { name: "Target", value: `<@${params.targetId}>`, inline: true },
            { name: "Moderator", value: `<@${params.moderatorId}>`, inline: true },
        )
        .setImage(params.attachmentUrl)
        .setTimestamp();

    if (params.note) embed.addFields({ name: "Note", value: params.note });

    await channel.send({ embeds: [embed] }).catch(() => null);
}

export function shortcutButtonCustomId(type: PunishType, guildId: string, targetId: string, reasonKey: string, moderatorId: string, extra = "none"): string {
    return `punish_shortcut_${type}_${guildId}_${targetId}_${reasonKey}_${moderatorId}_${extra}`;
}

export function parseShortcutButtonCustomId(customId: string): { type: PunishType; guildId: string; targetId: string; reasonKey: string; moderatorId: string; extra: string } | null {
    const parts = customId.split("_");
    if (parts.length < 8) return null;
    const [, , type, guildId, targetId, reasonKey, moderatorId, extra] = parts;
    return { type: type as PunishType, guildId, targetId, reasonKey, moderatorId, extra: extra ?? "none" };
}

/** A fake prefix interaction can't showModal() — DM a real button instead, which can (see punishShortcutDM.ts). */
export async function sendShortcutProofDM(client: BotClient, moderatorId: string, type: PunishType, guildId: string, targetId: string, reasonKey: string, extra = "none"): Promise<boolean> {
    const moderator = await client.users.fetch(moderatorId).catch(() => null);
    if (!moderator) return false;

    const embed = new EmbedBuilder()
        .setTitle(`${TITLES[type]} — Proof Required`)
        .setColor(Colors.warning)
        .setDescription(`You used the \`${type}\` shortcut on <@${targetId}>. Click below to attach proof before this action is finalized.`)
        .setTimestamp();

    const button = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(shortcutButtonCustomId(type, guildId, targetId, reasonKey, moderatorId, extra))
            .setLabel("Submit Proof")
            .setStyle(ButtonStyle.Primary)
            .setEmoji("📎"),
    );

    const sent = await moderator.send({ embeds: [embed], components: [button] }).catch(() => null);
    return Boolean(sent);
}

/** Only warn/mute award moderator points (per product decision — ban does not). */
export async function awardPunishPoints(guildId: string, moderatorId: string, moderatorUsername: string, type: PunishType): Promise<void> {
    if (type !== "warn" && type !== "mute") return;
    const config = await PunishConfigRepository.getCached(guildId);
    if (config.pointsPerAction <= 0) return;
    await ActivityRepository.addModerationPoints(moderatorId, guildId, moderatorUsername, config.pointsPerAction);
}
