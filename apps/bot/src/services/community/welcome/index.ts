import { AttachmentBuilder, type Guild, type GuildMember, type MessageCreateOptions, type PartialGuildMember, type SendableChannels } from "discord.js";
import { designPayload, type AnnounceDesign } from "@bot/utils/announce-design";
import { announcePayload } from "@bot/utils/announce-format";
import { fetchPicture, renderCard } from "@bot/utils/render-card";
import { WelcomeSettingsRepository } from "@database/repositories";
import type { WelcomeMessageDoc } from "@database/models/WelcomeSettings";
import { Logger } from "@logger";

/**
 * Welcome and goodbye (dashboard → Welcome): when a member joins or leaves, the server's message — plain text, an
 * embed or Components from the builder, or the text with a card (their picture, name and the server's own lines).
 * Each has its own switch. A welcome goes to the channel, the member's DMs, or both; a goodbye only to the channel.
 * Nothing is sent until a server turns one on.
 */

const CTX = "main:welcome";
const CARD_FILE = "welcome-card.png";

export type WelcomeKind = "join" | "leave";

interface Values { userId: string; username: string; server: string; members: number }

/** Fills [user], [username], [server], [members] and [#channel-id]. On a card [user] is the name (a mention can't be drawn). */
export function fillWelcomeText(text: string, v: Values, onCard = false): string {
    return text
        .replaceAll("[user]", onCard ? v.username : `<@${v.userId}>`)
        .replaceAll("[username]", v.username)
        .replaceAll("[server]", v.server)
        .replaceAll("[members]", String(v.members))
        .replace(/\[#(\d{15,22})\]/g, onCard ? "#channel" : "<#$1>");
}

async function drawCard(message: WelcomeMessageDoc, member: GuildMember | PartialGuildMember, values: Values): Promise<AttachmentBuilder | null> {
    try {
        const picture = await fetchPicture(member.user.displayAvatarURL({ extension: "png", size: 256 }));
        const png = await renderCard(
            message.card as never,
            { pictures: { avatar: picture }, texts: { name: values.username } },
            t => fillWelcomeText(t, values, true),
        );
        return png ? new AttachmentBuilder(png, { name: CARD_FILE }) : null;
    } catch (err) {
        Logger.warn(`Could not draw the ${member.guild.id} welcome card for ${member.id}: ${err}`, CTX);
        return null;
    }
}

/** Puts the card into a builder message: the embed's picture, or a gallery at the end of its (last) container. */
function addCard(payload: MessageCreateOptions, card: AttachmentBuilder): MessageCreateOptions {
    const files = [...((payload.files ?? []) as AttachmentBuilder[]), card];
    const url = `attachment://${CARD_FILE}`;
    const embeds = payload.embeds as Record<string, unknown>[] | undefined;
    if (embeds?.length) {
        const [first, ...rest] = embeds;
        return { ...payload, files, embeds: [{ ...first, ...(first!.image ? {} : { image: { url } }) }, ...rest] } as MessageCreateOptions;
    }
    const components = [...((payload.components ?? []) as unknown as Record<string, unknown>[])];
    const gallery = { type: 12, items: [{ media: { url } }] };
    const last = components[components.length - 1];
    if (last?.type === 17 && Array.isArray(last.components)) components[components.length - 1] = { ...last, components: [...last.components, gallery] };
    else components.push(gallery);
    return { ...payload, files, components } as unknown as MessageCreateOptions;
}

/** The message to send, or null when there's nothing to send. */
async function buildPayload(message: WelcomeMessageDoc, member: GuildMember | PartialGuildMember, values: Values, kind: WelcomeKind): Promise<MessageCreateOptions | null> {
    // A welcome pings the new member; a goodbye never pings anyone.
    const mentions = kind === "join" ? { users: [values.userId] } : { parse: [] as never[] };
    const fill = (t: string) => fillWelcomeText(t, values);
    const text = (message.text ?? "").trim() ? fill(message.text).slice(0, 2000) : "";

    if (message.mode === "embed" || message.mode === "components") {
        const design = message.design as unknown as AnnounceDesign | null;
        const built = design ? designPayload({ ...design, format: message.mode }, fill, mentions) : null;
        const payload = built ?? (text ? announcePayload(text, message.mode, null, mentions) as MessageCreateOptions : null);
        if (!payload) return null;
        const card = message.withCard ? await drawCard(message, member, values) : null;
        return card ? addCard(payload, card) : payload;
    }
    if (message.mode === "image") {
        const card = await drawCard(message, member, values);
        if (!card && !text) return null;
        return { ...(text ? { content: text } : {}), files: card ? [card] : [], allowedMentions: mentions };
    }
    return text ? { content: text, allowedMentions: mentions } : null;
}

async function channelOf(guild: Guild, id: string | null | undefined): Promise<SendableChannels | null> {
    if (!id) return null;
    const channel = guild.channels.cache.get(id) ?? await guild.channels.fetch(id).catch(() => null);
    return channel?.isSendable() ? channel : null;
}

/** Sends the server's welcome (join) or goodbye (leave) for this member, if it's on. Never throws. */
export async function sendWelcome(member: GuildMember | PartialGuildMember, kind: WelcomeKind): Promise<void> {
    try {
        if (member.user?.bot) return;
        const settings = await WelcomeSettingsRepository.get(member.guild.id);
        const message = settings?.[kind];
        if (!message?.enabled) return;

        const values: Values = {
            userId: member.id,
            username: member.displayName || member.user?.username || member.id,
            server: member.guild.name,
            members: member.guild.memberCount,
        };
        const toDm = kind === "join" && (message.send === "dm" || message.send === "both");
        const toChannel = kind === "leave" || message.send !== "dm";

        if (toChannel) {
            const channel = await channelOf(member.guild, message.channelId);
            const payload = channel ? await buildPayload(message, member, values, kind) : null;
            if (!channel) Logger.warn(`Welcome channel ${message.channelId} in ${member.guild.id} is missing or can't be sent to`, CTX);
            else if (payload) await channel.send(payload).catch(err => Logger.warn(`Could not post the ${kind} message in ${message.channelId}: ${err}`, CTX));
        }
        if (toDm) {
            // Attachments can't be reused across sends, so the DM gets its own copy.
            const payload = await buildPayload(message, member, values, kind);
            // Members who closed their DMs simply don't get it.
            if (payload) await member.send(payload).catch(() => null);
        }
    } catch (err) {
        Logger.warn(`Welcome (${kind}) failed in ${member.guild.id}: ${err}`, CTX);
    }
}

/** Whether this server sends its own welcome to a channel (the built-in greeting then stays quiet). */
export async function hasOwnWelcome(guildId: string): Promise<boolean> {
    const settings = await WelcomeSettingsRepository.get(guildId).catch(() => null);
    return Boolean(settings?.join?.enabled);
}
