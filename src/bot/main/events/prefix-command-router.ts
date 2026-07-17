import { Events, type Message } from "discord.js";
import type { BotClient } from "@core/BotClient";
import { DEFAULT_PREFIX } from "@core/config";
import { ServerConfigRepository } from "@database/repositories";
import { checkPermissions, cooldowns, commandError, releaseCooldown } from "@shared/utils/interaction-helper";
import { buildPrefixInteraction } from "../utils/prefixArgs";

export default {
    name: Events.MessageCreate,
    async execute(message: Message, client: BotClient) {
        if (message.author.bot || !message.guild) return;

        const prefix = (await ServerConfigRepository.getPrefix(message.guild.id)) ?? DEFAULT_PREFIX;
        if (!message.content.startsWith(prefix)) return;

        const withoutPrefix = message.content.slice(prefix.length);
        const spaceIdx = withoutPrefix.search(/\s/);
        const commandName = (spaceIdx === -1 ? withoutPrefix : withoutPrefix.slice(0, spaceIdx)).toLowerCase();
        if (!commandName) return;
        const argString = spaceIdx === -1 ? "" : withoutPrefix.slice(spaceIdx + 1);

        const command = client.commands.get(commandName);
        if (!command) return;

        if (command.modalOnly) {
            await message
                .reply({ content: `\`${commandName}\` needs its form fields — use \`/${commandName}\` instead.`, allowedMentions: { repliedUser: false } })
                .catch(() => null);
            return;
        }

        if (typeof (command.data as any).toJSON !== "function") return;

        const { interaction, error } = await buildPrefixInteraction(message, client, command, argString, prefix);
        if (error) {
            await message.reply({ content: error, allowedMentions: { repliedUser: false } }).catch(() => null);
            return;
        }

        try {
            const hasPerms = await checkPermissions(interaction, command);
            if (!hasPerms) return;

            const canProceed = await cooldowns(interaction, command);
            if (!canProceed) return;

            try {
                await command.run(interaction, client);
            } catch (err) {
                releaseCooldown(interaction);
                throw err;
            }
        } catch (err) {
            await commandError(err, interaction, client);
        }
    },
};
