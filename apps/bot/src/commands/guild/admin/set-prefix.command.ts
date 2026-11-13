import { SlashCommandBuilder, type ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from "discord.js";
import type { BotClient } from "@core/bot-client";
import { COLORS, DEFAULT_PREFIX } from "@constants";
import { ServerConfigRepository } from "@database/repositories";

import { L } from "@utils";
export default {
    scope: "guild",
    category: "Configuration",
    data: new SlashCommandBuilder()
        .setName("set-prefix")
        .setDescription("Set the text-command prefix for this server")
        .addStringOption(opt =>
            opt.setName("prefix").setDescription("New prefix (e.g. !)").setRequired(true).setMinLength(1).setMaxLength(5)
        ),

    requiredPermission: 100,

    async run(interaction: ChatInputCommandInteraction, _client: BotClient) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const prefix = interaction.options.getString("prefix", true).trim();
        if (!prefix || /\s/.test(prefix)) {
            await interaction.editReply({
                embeds: [new EmbedBuilder().setDescription(L("❌ Prefix can't be empty or contain spaces.", "❌ البادئة ما تكون فاضية ولا فيها مسافات.")).setColor(COLORS.error)],
            });
            return;
        }

        await ServerConfigRepository.setPrefix(interaction.guildId!, prefix);

        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setTitle(L("✅ Prefix updated", "✅ تم تغيير البادئة"))
                .setColor(COLORS.success)
                .setDescription(L(`Text commands in this server now use \`${prefix}\` (e.g. \`${prefix}profile\`). Default is \`${DEFAULT_PREFIX}\` when unset.`, `الأوامر الكتابية في السيرفر صارت تبدأ بـ \`${prefix}\` (مثل \`${prefix}profile\`). الافتراضي \`${DEFAULT_PREFIX}\`.`))],
        });
    },
};
