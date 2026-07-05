import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    MessageFlags,
    PermissionFlagsBits,
    type TextChannel,
} from "discord.js";
import type { BotClient } from "@core/BotClient";
import { AdsConfigRepository } from "@database/repositories";
import { buildAdsPanel } from "../utils/adsPanels";
import { buildConfigRoot } from "../utils/adsConfigViews";

export default {
    data: new SlashCommandBuilder()
        .setName("setup-ads")
        .setDescription("Configure the advertisement system")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub
                .setName("channel")
                .setDescription("Set the channel where new ad orders are sent for approval")
                .addChannelOption(opt =>
                    opt.setName("channel").setDescription("The approval channel").setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName("panel").setDescription("Post the advertisement ordering panel in this channel")
        )
        .addSubcommand(sub =>
            sub.setName("config").setDescription("Open the ads configuration panel (prices, details, exchange rate)")
        ),

    async run(interaction: ChatInputCommandInteraction, client: BotClient) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId!;

        if (sub === "channel") {
            const channel = interaction.options.getChannel("channel", true) as TextChannel;
            await AdsConfigRepository.setApprovalChannel(guildId, channel.id);

            await interaction.reply({
                content: `✅ Ad orders will now be sent to ${channel} for approval.`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (sub === "panel") {
            const config = await AdsConfigRepository.get(guildId);
            const channel = interaction.channel as TextChannel;

            const { components, files } = buildAdsPanel(config);
            const msg = await channel.send({ components, files, flags: MessageFlags.IsComponentsV2 });

            await AdsConfigRepository.setPanel(guildId, channel.id, msg.id);

            await interaction.reply({
                content: `✅ Ads panel posted in ${channel}.`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (sub === "config") {
            const config = await AdsConfigRepository.get(guildId);
            await interaction.reply({
                ...buildConfigRoot(config),
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            });
        }
    },
};
