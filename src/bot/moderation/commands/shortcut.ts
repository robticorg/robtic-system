import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    AutocompleteInteraction,
    EmbedBuilder,
    PermissionFlagsBits,
    MessageFlags,
} from "discord.js";
import type { BotClient } from "@core/BotClient";
import { ServerConfigRepository } from "@database/repositories/ServerConfigRepository";
import { ChatUtils } from "../utils/chat";
import { Colors } from "@core/config";

const chatUtilCommands = Object.keys(ChatUtils);

export default {
    data: new SlashCommandBuilder()
        .setName("shortcut")
        .setDescription("Manage message shortcuts for moderation commands")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(sub =>
            sub.setName("add")
                .setDescription("Add a new shortcut")
                .addStringOption(opt =>
                    opt.setName("command")
                        .setDescription("The moderation command to execute")
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addStringOption(opt =>
                    opt.setName("msg")
                        .setDescription("The message that triggers this command")
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName("remove")
                .setDescription("Remove a shortcut")
                .addStringOption(opt =>
                    opt.setName("msg")
                        .setDescription("The trigger message to remove")
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName("list")
                .setDescription("List current shortcuts")
        ),

    async autocomplete(interaction: AutocompleteInteraction, client: BotClient) {
        const focused = interaction.options.getFocused(true);
        if (focused.name === "command") {
            const allCommands = [...new Set([...chatUtilCommands, ...client.commands.keys()])];
            const items = allCommands
                .filter(c => c.toLowerCase().startsWith(focused.value.toLowerCase()))
                .slice(0, 25);
            await interaction.respond(items.map(c => ({ name: chatUtilCommands.includes(c) ? `${c} (chat)` : c, value: c })));
        } else if (focused.name === "msg") {
            if (!interaction.guildId) return;
            const shortcuts = await ServerConfigRepository.getShortcuts(interaction.guildId);
            const items = shortcuts.filter(s => s.trigger.toLowerCase().startsWith(focused.value.toLowerCase()));
            await interaction.respond(items.map(s => ({ name: s.trigger, value: s.trigger })));
        }
    },

    async run(interaction: ChatInputCommandInteraction, client: BotClient) {
        if (!interaction.guildId) return;
        await interaction.deferReply();

        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        if (subcommand === "add") {
            const command = interaction.options.getString("command", true);
            const trigger = interaction.options.getString("msg", true);

            const isChatUtil = chatUtilCommands.includes(command);
            if (!isChatUtil && !client.commands.has(command)) {
                await interaction.deleteReply().catch(() => {});
                await interaction.followUp({ content: `Unknown command \`${command}\` — pick a suggestion from autocomplete.`, flags: MessageFlags.Ephemeral });
                return;
            }

            await ServerConfigRepository.addShortcut(guildId, command, trigger);

            await interaction.deleteReply().catch(() => {});
            await interaction.followUp({
                content: `Shortcut added! Typing "${trigger}" will now execute "${isChatUtil ? `/chat ${command}` : `/${command}`}".`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        } else if (subcommand === "remove") {
            const trigger = interaction.options.getString("msg", true);
            const result = await ServerConfigRepository.removeShortcut(guildId, trigger);

            if (!result) {
                await interaction.deleteReply().catch(() => {});
                await interaction.followUp({ content: "Error accessing database.", flags: MessageFlags.Ephemeral });
                return;
            }

            await interaction.deleteReply().catch(() => {});
            await interaction.followUp({ content: `Shortcut "${trigger}" removed (if it existed).`, flags: MessageFlags.Ephemeral });
            return;
        } else if (subcommand === "list") {
            const shortcuts = await ServerConfigRepository.getShortcuts(guildId);
            if (shortcuts.length === 0) {
                await interaction.deleteReply().catch(() => {});
                await interaction.followUp({ content: "No shortcuts defined.", flags: MessageFlags.Ephemeral });
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle("Moderation Shortcuts")
                .setDescription(shortcuts.map(s => `• \`${s.trigger}\` → \`${chatUtilCommands.includes(s.command) ? `/chat ${s.command}` : `/${s.command}`}\``).join("\n"))
                .setColor(Colors.info || 0x3498DB);

            await interaction.editReply({ embeds: [embed] });
        }
    }
};
