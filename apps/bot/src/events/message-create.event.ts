import { Events, type Message, AttachmentBuilder, PermissionFlagsBits } from "discord.js";
import { ServerConfigRepository } from "@database/repositories";
import { BRANCH_EMOJIS as emojis } from "@config";
import { getLineImage } from "@core/assets";
import type { BotClient } from "@core/bot-client";
import { matchesLineShortcut } from "@bot/utils/line/line-shortcuts";

/**
 * The line image (`/setline`), posted two ways:
 *
 * - a shortcut word (`/line shortcut`) sent on its own by someone who can manage messages there:
 *   the word is deleted and the line takes its place;
 * - an auto-line channel (`/autoline`): every message gets the line after it, and a reaction.
 */
export default {
    name: Events.MessageCreate,

    async execute(message: Message, _client: BotClient) {
        if (message.author.bot) return;
        if (!message.inGuild() || !message.channel.isSendable()) return;

        const { channels, shortcuts } = await ServerConfigRepository.getLineConfig(message.guild.id);
        const isShortcut = matchesLineShortcut(message.content, shortcuts)
            && Boolean(message.member?.permissionsIn(message.channel.id).has(PermissionFlagsBits.ManageMessages));
        const isAutoLine = channels.includes(message.channel.id);
        if (!isShortcut && !isAutoLine) return;

        const line = await getLineImage().catch(() => null);
        if (!line) return;

        await message.channel.send({ files: [new AttachmentBuilder(line.data, { name: line.name })] }).catch(() => null);

        if (isShortcut) {
            await message.delete().catch(() => null);
            return;
        }

        await message.react(emojis.add).catch(() => null);
    },
};
