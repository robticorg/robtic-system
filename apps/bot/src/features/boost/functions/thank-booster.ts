import { MessageFlags, type Guild } from "discord.js";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import { BOOST_CONFIG } from "@constants";
import { isFeatureEnabled } from "@core/features";
import { ServerConfigRepository } from "@database/repositories";
import { handleError, BotError } from "@core/handlers";
import { buildBoostThanks } from "../utils/boost-message";
import { createBoostBatcher } from "../utils/boost-batcher";

const LINE_IMAGE_PATH = path.join(process.cwd(), "images", "line.png");

async function resolveEmoji(guild: Guild): Promise<string> {
    const own = guild.emojis.cache.find(e => e.name === BOOST_CONFIG.emojiName);
    if (own) return own.toString();

    const appEmojis = await guild.client.application?.emojis.fetch().catch(() => null);
    return appEmojis?.find(e => e.name === BOOST_CONFIG.emojiName)?.toString() ?? "";
}

/**
 * Posts the thank-you for a finished batch in the `/boost channel`, `maxMentionsPerMessage` members
 * per message. Silent when no channel is set, it is gone, or the feature is off.
 */
async function sendBoostThanks(guild: Guild, memberIds: string[]): Promise<void> {
    const channelId = await ServerConfigRepository.getBoostChannel(guild.id);
    if (!channelId || !(await isFeatureEnabled(guild.id, "boost"))) return;

    const channel = guild.channels.cache.get(channelId);
    if (!channel?.isSendable()) return;

    const [emoji, line] = await Promise.all([
        resolveEmoji(guild),
        existsSync(LINE_IMAGE_PATH) ? readFile(LINE_IMAGE_PATH) : Promise.resolve(null),
    ]);
    const icon = guild.iconURL({ size: 256 });

    for (let i = 0; i < memberIds.length; i += BOOST_CONFIG.maxMentionsPerMessage) {
        const group = memberIds.slice(i, i + BOOST_CONFIG.maxMentionsPerMessage);
        await channel.send({
            ...buildBoostThanks(group, emoji, icon, line),
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { users: group },
        });
    }
}

/** In memory: a restart drops a batch that was still waiting. */
const batcher = createBoostBatcher<Guild>(BOOST_CONFIG.batchQuietMs, (guild, memberIds) => {
    sendBoostThanks(guild, memberIds).catch(err =>
        handleError(new BotError(`Failed to thank boosters: ${err}`, "EVENT"), "main/boost"));
});

/**
 * Adds a booster to the guild's batch and restarts its 30-minute wait. Thanks go out only once a
 * full `batchQuietMs` passes with no new boost — then everyone in the batch is thanked together,
 * each listed once.
 */
export function queueBoostThanks(guild: Guild, memberId: string): void {
    batcher.add(guild.id, guild, memberId);
}
