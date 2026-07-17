import { SlashCommandBuilder, type ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from "discord.js";
import type { BotClient } from "@core/BotClient";
import { Colors, DEFAULT_PREFIX } from "@core/config";
import { ServerConfigRepository } from "@database/repositories";

export default {
    data: new SlashCommandBuilder()
        .setName("set-prefix")
        .setDescription("Set the text-command prefix for this server")
        .addStringOption(opt =>
            opt.setName("prefix").setDescription("New prefix (e.g. !)").setRequired(true).setMinLength(1).setMaxLength(5)
        ),

    requiredPermission: 100,
    department: "Management" as Department,

    async run(interaction: ChatInputCommandInteraction, _client: BotClient) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const prefix = interaction.options.getString("prefix", true).trim();
        if (!prefix || /\s/.test(prefix)) {
            await interaction.editReply({
                embeds: [new EmbedBuilder().setDescription("❌ Prefix can't be empty or contain spaces.").setColor(Colors.error)],
            });
            return;
        }

        await ServerConfigRepository.setPrefix(interaction.guildId!, prefix);

        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setTitle("✅ Prefix Updated")
                .setColor(Colors.success)
                .setDescription(`Text commands in this server now use \`${prefix}\` (e.g. \`${prefix}profile\`). Default is \`${DEFAULT_PREFIX}\` when unset.`)],
        });
    },
};
