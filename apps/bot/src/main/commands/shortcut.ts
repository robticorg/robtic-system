import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    AutocompleteInteraction,
    EmbedBuilder,
    PermissionFlagsBits,
    MessageFlags,
} from "discord.js";
import { ClientManager } from "@core/client-manager";
import { ServerConfigRepository } from "@database/repositories/ServerConfigRepository";
import { COLORS } from "@constants";

// Executed only by moderation bot's message-create.ts (the ChatUtils utility actions) — listed
// here just so /shortcut's autocomplete/labeling knows about them without importing moderation's
// chat.ts across bot boundaries.
const CHAT_UTIL_COMMANDS = ["lock", "unlock", "hide", "show", "slowmode", "clear"];

function getAllCommandNames(): string[] {
    const names = new Set<string>(CHAT_UTIL_COMMANDS);
    for (const client of ClientManager.getInstance().getAllClients()) {
        for (const name of client.commands.keys()) names.add(name);
    }
    return [...names];
}

function commandExists(command: string): boolean {
    if (CHAT_UTIL_COMMANDS.includes(command)) return true;
    return ClientManager.getInstance().getAllClients().some(client => client.commands.has(command));
}

export default {
    data: new SlashCommandBuilder()
        .setName("shortcut")
        .setDescription("Manage custom message-trigger shortcuts, for any bot's commands")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(sub =>
            sub.setName("add")
                .setDescription("Add a new shortcut")
                .addStringOption(opt =>
                    opt.setName("command")
                        .setDescription("The command to execute (any bot)")
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

    async autocomplete(interaction: AutocompleteInteraction) {
        const focused = interaction.options.getFocused(true);
        if (focused.name === "command") {
            const items = getAllCommandNames()
                .filter(c => c.toLowerCase().startsWith(focused.value.toLowerCase()))
                .sort()
                .slice(0, 25);
            await interaction.respond(items.map(c => ({ name: CHAT_UTIL_COMMANDS.includes(c) ? `${c} (chat)` : c, value: c })));
        } else if (focused.name === "msg") {
            if (!interaction.guildId) return;
            const shortcuts = await ServerConfigRepository.getShortcuts(interaction.guildId);
            const items = shortcuts.filter(s => s.trigger.toLowerCase().startsWith(focused.value.toLowerCase()));
            await interaction.respond(items.map(s => ({ name: s.trigger, value: s.trigger })));
        }
    },

    async run(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) return;
        await interaction.deferReply();

        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        if (subcommand === "add") {
            const command = interaction.options.getString("command", true);
            const trigger = interaction.options.getString("msg", true);

            if (!commandExists(command)) {
                await interaction.deleteReply().catch(() => {});
                await interaction.followUp({ content: `Unknown command \`${command}\` — pick a suggestion from autocomplete.`, flags: MessageFlags.Ephemeral });
                return;
            }

            await ServerConfigRepository.addShortcut(guildId, command, trigger);

            const isChatUtil = CHAT_UTIL_COMMANDS.includes(command);
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
                .setTitle("Shortcuts")
                .setDescription(shortcuts.map(s => `• \`${s.trigger}\` → \`${CHAT_UTIL_COMMANDS.includes(s.command) ? `/chat ${s.command}` : `/${s.command}`}\``).join("\n"))
                .setColor(COLORS.info || 0x3498DB);

            await interaction.editReply({ embeds: [embed] });
        }
    }
};
