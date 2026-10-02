import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
} from "discord.js";
import { LevelRewardRepository } from "@database/repositories";
import { COLORS } from "@constants";

/** "Message 10 + Voice 5" — what a level-reward role requires. */
function describe(reward: { messageLevel: number | null; voiceLevel: number | null }): string {
    return [
        reward.messageLevel ? `💬 Message **${reward.messageLevel}**` : "",
        reward.voiceLevel ? `🎙️ Voice **${reward.voiceLevel}**` : "",
    ].filter(Boolean).join(" + ");
}

export default {
    scope: "guild",
    category: "Configuration",
    data: new SlashCommandBuilder()
        .setName("level-rewards")
        .setDescription("Manage level reward roles")

        .addSubcommand(sub =>
            sub
                .setName("set")
                .setDescription("Give a role for reaching a message level, a voice level, or both")
                .addRoleOption(opt =>
                    opt.setName("role").setDescription("Role to grant").setRequired(true)
                )
                .addIntegerOption(opt =>
                    opt.setName("message_level").setDescription("Message level required (leave empty if none)").setMinValue(1)
                )
                .addIntegerOption(opt =>
                    opt.setName("voice_level").setDescription("Voice level required (leave empty if none)").setMinValue(1)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("remove")
                .setDescription("Remove a level reward role")
                .addRoleOption(opt =>
                    opt.setName("role").setDescription("Role to stop granting").setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("list")
                .setDescription("List all level rewards")
        ),

    requiredPermission: 80,

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const guildId = interaction.guildId!;
        const sub = interaction.options.getSubcommand();

        if (sub === "set") {
            const role = interaction.options.getRole("role", true);
            const messageLevel = interaction.options.getInteger("message_level");
            const voiceLevel = interaction.options.getInteger("voice_level");

            if (!messageLevel && !voiceLevel) {
                await interaction.editReply({ content: "Set a `message_level`, a `voice_level`, or both." });
                return;
            }

            const reward = await LevelRewardRepository.set(guildId, role.id, messageLevel || null, voiceLevel || null);
            await interaction.editReply({
                content: `<@&${role.id}> will be granted at ${describe(reward)}.`,
                allowedMentions: { parse: [] },
            });
        }

        else if (sub === "remove") {
            const role = interaction.options.getRole("role", true);
            const removed = await LevelRewardRepository.remove(guildId, role.id);

            await interaction.editReply({
                content: removed
                    ? `<@&${role.id}> is no longer a level reward.`
                    : `<@&${role.id}> isn't a level reward.`,
                allowedMentions: { parse: [] },
            });
        }

        else if (sub === "list") {
            const rewards = await LevelRewardRepository.getAll(guildId);

            if (rewards.length === 0) {
                await interaction.editReply({ content: "No level rewards configured." });
                return;
            }

            const lines = rewards.map(r => `${describe(r)} → <@&${r.roleId}>`);

            const embed = new EmbedBuilder()
                .setTitle("Level Rewards")
                .setDescription(lines.join("\n"))
                .setColor(COLORS.activity)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }
    },
};
