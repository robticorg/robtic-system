import {
    SlashCommandBuilder,
    type ChatInputCommandInteraction,
    MessageFlags,
} from "discord.js";
import { ServerConfigRepository } from "@database/repositories";
import { LINE_SHORTCUT_LIMITS, parseLineShortcuts } from "@bot/utils/line/line-shortcuts";

/**
 * `/line shortcut [words] [clear]` — words that post the line: when an Administrator, or a member
 * with a role from `/line role`, sends one of them on its own, the bot deletes it and posts the
 * line image (`/setline`) instead.
 *
 * `/line role [role] [remove]` — the roles allowed to do that, besides Administrators.
 *
 * Auto-line channels moved to `/autoline`.
 */
export default {
    scope: "guild",
    category: "Configuration",
    data: new SlashCommandBuilder()
        .setName("line")
        .setDescription("The line image, the words that post it, and who may use them")
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
        )
        .addSubcommand(sub =>
            sub.setName("role")
                .setDescription("Allow a role to post the line (Administrators always can; no role shows the list)")
                .addRoleOption(opt =>
                    opt.setName("role").setDescription("The role")
                )
                .addBooleanOption(opt =>
                    opt.setName("remove").setDescription("Take the permission away from this role instead")
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
        const roles = (ids: string[]) => ids.map(id => `<@&${id}>`).join(", ");

        if (interaction.options.getSubcommand() === "role") {
            const role = interaction.options.getRole("role");
            if (!role) {
                const { roleIds } = await ServerConfigRepository.getLineConfig(guildId);
                await interaction.editReply({
                    content: roleIds.length
                        ? `Administrators and these roles can post the line: ${roles(roleIds)}`
                        : "Only Administrators can post the line. Allow a role with `/line role role:`.",
                    allowedMentions: { parse: [] },
                });
                return;
            }

            const remove = interaction.options.getBoolean("remove") ?? false;
            await ServerConfigRepository.setLineRole(guildId, role.id, !remove);
            await interaction.editReply({
                content: remove
                    ? `<@&${role.id}> can no longer post the line.`
                    : `<@&${role.id}> can now post the line with a shortcut word.`,
                allowedMentions: { parse: [] },
            });
            return;
        }

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
            content: `Line shortcuts set: ${list(words)}.\nAdministrators and roles from \`/line role\` can send one on its own to replace it with the line.`,
        });
    },
};
