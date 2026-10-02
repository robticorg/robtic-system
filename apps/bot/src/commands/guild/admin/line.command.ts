import {
    SlashCommandBuilder,
    type ChatInputCommandInteraction,
    MessageFlags,
} from "discord.js";
import { ServerConfigRepository } from "@database/repositories";
import { LINE_SHORTCUT_LIMITS, parseLineShortcuts } from "@bot/utils/line/line-shortcuts";

/**
 * `/line shortcut [words] [clear]` — words that post the line: when someone who can manage messages
 * sends one of them on its own, the bot deletes it and posts the line image (`/setline`) instead.
 * Auto-line channels moved to `/autoline`.
 */
export default {
    scope: "guild",
    category: "Configuration",
    data: new SlashCommandBuilder()
        .setName("line")
        .setDescription("The line image and the words that post it")
        .addSubcommand(sub =>
            sub.setName("shortcut")
                .setDescription("Set the words that post the line (no words shows the current ones)")
                .addStringOption(opt =>
                    opt.setName("words")
                        .setDescription("Comma-separated, e.g. خط, line — replaces the current list")
                        .setMaxLength(500)
                )
                .addBooleanOption(opt =>
                    opt.setName("clear").setDescription("Remove every shortcut word")
                )
        ),

    requiredPermission: 100,

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const guildId = interaction.guildId;
        if (!guildId) {
            await interaction.editReply({ content: "❌ This command can only be used in a server." });
            return;
        }

        const list = (words: string[]) => words.map(w => `\`${w}\``).join(", ");

        if (interaction.options.getBoolean("clear")) {
            await ServerConfigRepository.setLineShortcuts(guildId, []);
            await interaction.editReply({ content: "Line shortcuts removed." });
            return;
        }

        const input = interaction.options.getString("words");
        if (input === null) {
            const { shortcuts } = await ServerConfigRepository.getLineConfig(guildId);
            await interaction.editReply({
                content: shortcuts.length
                    ? `Line shortcuts: ${list(shortcuts)}`
                    : "No line shortcuts set. Add some with `/line shortcut words:`.",
            });
            return;
        }

        const words = parseLineShortcuts(input);
        if (!words.length) {
            await interaction.editReply({ content: `Give at least one word (up to ${LINE_SHORTCUT_LIMITS.maxLength} characters each), separated by commas.` });
            return;
        }

        await ServerConfigRepository.setLineShortcuts(guildId, words);
        await interaction.editReply({
            content: `Line shortcuts set: ${list(words)}.\nSending one of them on its own (if you can manage messages) replaces it with the line.`,
        });
    },
};
