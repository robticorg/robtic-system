import { isBrandedGuild } from "@core/assets";
import { AttachmentBuilder, type Guild, type TextChannel } from "discord.js";
import { XPSettingsRepository } from "@database/repositories";
import { LEVEL_UP_MESSAGES } from "@constants";
import type { XpKind } from "@core/xp";
import { Logger } from "@logger";
import { renderLevelCard } from "./render-level-card";
import type { LevelCardLayoutDoc } from "@database/models/XPSettings";

import { L } from "@utils";
/**
 * Fills the server's level-up text: [user] mention, [username], [level], [type] (Message / Voice), [server], and
 * [#123…] channel mentions. Capped at Discord's 2,000 characters.
 */
export function fillLevelUpText(text: string, v: { userId: string; username: string; level: number; kind: XpKind; server: string }): string {
    return text
        .replaceAll("[user]", `<@${v.userId}>`)
        .replaceAll("[username]", v.username)
        .replaceAll("[level]", String(v.level))
        .replaceAll("[type]", L(v.kind === "voice" ? "Voice" : "Message", v.kind === "voice" ? "الصوت" : "الرسائل"))
        .replaceAll("[server]", v.server)
        .replace(/\[#(\d{15,22})\]/g, "<#$1>")
        .slice(0, 2000);
}

const CTX = "main:xp";

/** The level-up card for this member, or `null` when it can't be drawn — the text is posted instead. */
async function buildLevelCard(guild: Guild, userId: string, kind: XpKind, level: number, layout?: LevelCardLayoutDoc | null): Promise<AttachmentBuilder | null> {
    try {
        const member = guild.members.cache.get(userId) ?? await guild.members.fetch(userId);
        const avatar = await fetch(member.displayAvatarURL({ extension: "png", size: 256 }))
            .then(async response => (response.ok ? Buffer.from(await response.arrayBuffer()) : null))
            .catch(() => null);

        const card = await renderLevelCard({ avatar, name: member.displayName, kind, level, layout });
        return new AttachmentBuilder(card, { name: "level-up.jpg" });
    } catch (err) {
        Logger.warn(`Could not draw the level-up card for ${userId} in ${guild.id}: ${err}`, CTX);
        return null;
    }
}

/**
 * Posts a level-up to the configured channel: the level-up card (`images/level.png` with the
 * member's avatar, name, level type and level) and a mention so they are notified. If the card
 * can't be drawn, the text announcement is posted as before.
 *
 * Silent when no channel is set — unlike streaks, which fall back to replying in place, an XP
 * level-up has no single channel it "belongs" to and announcing it wherever the member happened to
 * be typing would be noise in the middle of a conversation.
 */
export async function announceLevelUp(guild: Guild, userId: string, kind: XpKind, level: number): Promise<void> {
    const settings = await XPSettingsRepository.get(guild.id);
    if (!settings?.levelUpChannelId) return;

    const channel = guild.channels.cache.get(settings.levelUpChannelId)
        ?? await guild.channels.fetch(settings.levelUpChannelId).catch(() => null);

    if (!channel?.isTextBased()) {
        Logger.warn(`Level-up channel ${settings.levelUpChannelId} in ${guild.id} is missing or not text`, CTX);
        return;
    }

    // The server's own announcement (dashboard), else Robtic's card with a mention.
    const custom = settings.levelUpMessage;
    const member = guild.members.cache.get(userId);
    const text = custom?.text?.trim()
        ? fillLevelUpText(custom.text, { userId, username: member?.displayName ?? "", level, kind, server: guild.name })
        : null;
    // A card needs an image: the server's own (dashboard), or Robtic's built-in one in Robtic's own servers.
    const wantsCard = custom ? custom.mode === "image" && Boolean(custom.card?.background) : isBrandedGuild(guild.id);
    const card = wantsCard ? await buildLevelCard(guild, userId, kind, level, custom?.card) : null;

    await (channel as TextChannel).send({
        content: card ? (text ?? `<@${userId}>`) : (text ?? LEVEL_UP_MESSAGES.reached(userId, kind, level)),
        files: card ? [card] : [],
        allowedMentions: { users: [userId] },
    }).catch(err => {
        Logger.warn(`Could not post level-up announcement in ${settings.levelUpChannelId}: ${err}`, CTX);
    });
}
