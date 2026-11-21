import { ContainerBuilder, EmbedBuilder, MessageFlags, TextDisplayBuilder, type MessageMentionOptions } from "discord.js";

/** How the dashboard says an announcement is sent: plain text, the text in an embed, or in a Components (V2) container. */
export type AnnounceFormat = "text" | "embed" | "components";

export const DEFAULT_ANNOUNCE_COLOR = 0x3d7bff;

const toColor = (hex: unknown): number => (typeof hex === "string" && /^#[0-9a-f]{6}$/i.test(hex) ? parseInt(hex.slice(1), 16) : DEFAULT_ANNOUNCE_COLOR);

export const isAnnounceFormat = (v: unknown): v is AnnounceFormat => v === "text" || v === "embed" || v === "components";

/** The message to send for `text` in the server's chosen format and colour. */
export function announcePayload(text: string, format: AnnounceFormat, color: unknown, allowedMentions: MessageMentionOptions = { parse: [] }) {
    if (format === "embed") {
        return { embeds: [new EmbedBuilder().setDescription(text.slice(0, 4096)).setColor(toColor(color))], allowedMentions };
    }
    if (format === "components") {
        const box = new ContainerBuilder().setAccentColor(toColor(color)).addTextDisplayComponents(new TextDisplayBuilder().setContent(text.slice(0, 4000)));
        return { components: [box], flags: MessageFlags.IsComponentsV2 as const, allowedMentions };
    }
    return { content: text.slice(0, 2000), allowedMentions };
}
