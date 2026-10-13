import { AttachmentBuilder, type Guild, type TextChannel } from "discord.js";
import { XPSettingsRepository } from "@database/repositories";
import { LEVEL_UP_MESSAGES } from "@constants";
import type { XpKind } from "@core/xp";
import { Logger } from "@logger";
import { renderLevelCard } from "./render-level-card";

const CTX = "main:xp";

/** The level-up card for this member, or `null` when it can't be drawn — the text is posted instead. */
async function buildLevelCard(guild: Guild, userId: string, kind: XpKind, level: number): Promise<AttachmentBuilder | null> {
    try {
        const member = guild.members.cache.get(userId) ?? await guild.members.fetch(userId);
        const avatar = await fetch(member.displayAvatarURL({ extension: "png", size: 256 }))
            .then(async response => (response.ok ? Buffer.from(await response.arrayBuffer()) : null))
            .catch(() => null);

        const card = await renderLevelCard({ avatar, name: member.displayName, kind, level });
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

    const card = await buildLevelCard(guild, userId, kind, level);

    await (channel as TextChannel).send({
        content: card ? `<@${userId}>` : LEVEL_UP_MESSAGES.reached(userId, kind, level),
        files: card ? [card] : [],
        allowedMentions: { users: [userId] },
    }).catch(err => {
        Logger.warn(`Could not post level-up announcement in ${settings.levelUpChannelId}: ${err}`, CTX);
    });
}
