import { AttachmentBuilder, MediaGalleryBuilder, MessageFlags, TextDisplayBuilder, type Guild } from "discord.js";
import { BOOST_CONFIG } from "@constants";
import { getLineImage, isBrandedGuild } from "@core/assets";
import { fetchPicture, renderCard, type CardLayoutDoc } from "@bot/utils/render-card";

const DEFAULT_THANKS = "[users] thank you for boosting [server]!";

/** Fills the server's thank-you: [users], [server], [count], [#123…] channel mentions. */
export function fillBoostText(text: string, memberIds: readonly string[], server: string): string {
    return text
        .replaceAll("[users]", memberIds.map(id => `<@${id}>`).join(", "))
        .replaceAll("[server]", server)
        .replaceAll("[count]", String(memberIds.length))
        .replace(/\[#(\d{15,22})\]/g, "<#$1>")
        .slice(0, 3800);
}

/** The server's own thank-you: its text, a card per booster (if it designed one) and its line (if it chose to). */
async function buildCustomThanks(guild: Guild, memberIds: readonly string[], config: NonNullable<Awaited<ReturnType<typeof ServerConfigRepository.find>>>["boostMessage"]) {
    const text = fillBoostText(config?.text?.trim() || DEFAULT_THANKS, memberIds, guild.name);
    const files: AttachmentBuilder[] = [];
    const components: (TextDisplayBuilder | MediaGalleryBuilder)[] = [new TextDisplayBuilder().setContent(text)];

    if (config?.mode === "image") {
        const gallery = new MediaGalleryBuilder();
        for (const id of memberIds.slice(0, 10)) {
            const member = guild.members.cache.get(id) ?? await guild.members.fetch(id).catch(() => null);
            const card = await renderCard(config.card as CardLayoutDoc | undefined, {
                pictures: { avatar: await fetchPicture(member?.displayAvatarURL({ extension: "png", size: 256 })) },
                texts: { name: member?.displayName ?? "" },
            });
            if (!card) break;
            const name = `boost-${id}.png`;
            files.push(new AttachmentBuilder(card, { name }));
            gallery.addItems(item => item.setURL(`attachment://${name}`));
        }
        if (files.length) components.push(gallery);
    }
    if (config?.withLine) {
        const line = await getLineImage(guild.id).catch(() => null);
        if (line) {
            files.push(new AttachmentBuilder(line.data, { name: line.name }));
            components.push(new MediaGalleryBuilder().addItems(item => item.setURL(`attachment://${line.name}`)));
        }
    }
    return { components, files };
}
import { isFeatureEnabled } from "@core/features";
import { ServerConfigRepository } from "@database/repositories";
import { handleError, BotError } from "@core/handlers";
import { buildBoostThanks } from "../utils/boost-message";
import { createBoostBatcher } from "../utils/boost-batcher";

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

    const config = (await ServerConfigRepository.find(guild.id))?.boostMessage ?? null;

    // Robtic's own servers keep Robtic's thank-you until they design their own.
    if (!config && isBrandedGuild(guild.id)) {
        const [emoji, line] = await Promise.all([resolveEmoji(guild), getLineImage(guild.id).catch(() => null)]);
        for (let i = 0; i < memberIds.length; i += BOOST_CONFIG.maxMentionsPerMessage) {
            const group = memberIds.slice(i, i + BOOST_CONFIG.maxMentionsPerMessage);
            await channel.send({ ...buildBoostThanks(group, emoji, line), flags: MessageFlags.IsComponentsV2, allowedMentions: { users: group } });
        }
        return;
    }

    // Cards: at most 10 images per message, so image mode sends boosters in tens.
    const per = config?.mode === "image" ? 10 : BOOST_CONFIG.maxMentionsPerMessage;
    for (let i = 0; i < memberIds.length; i += per) {
        const group = memberIds.slice(i, i + per);
        await channel.send({ ...(await buildCustomThanks(guild, group, config)), flags: MessageFlags.IsComponentsV2, allowedMentions: { users: group } });
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
