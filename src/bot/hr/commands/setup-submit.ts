import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    MessageFlags,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    PermissionFlagsBits,
    type TextChannel,
} from "discord.js";
import type { BotClient } from "@core/BotClient";
import { Colors } from "@core/config";
import { SubmitConfigRepository, SubmissionTypeRepository } from "@database/repositories";
import { updatePanel } from "../utils/updatePanel";

export default {
    data: new SlashCommandBuilder()
        .setName("setup-submit")
        .setDescription("Configure the staff submission system")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub
                .setName("channel")
                .setDescription("Set the channel where all submission reviews are sent")
                .addChannelOption(opt =>
                    opt.setName("channel").setDescription("The review channel").setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("panel")
                .setDescription("Post the application panel in this channel (select menu for users)")
        ),

    async run(interaction: ChatInputCommandInteraction, client: BotClient) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId!;

        if (sub === "channel") {
            const channel = interaction.options.getChannel("channel", true) as TextChannel;

            await SubmitConfigRepository.setReviewChannel(guildId, channel.id);

            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("✅ Submit Review Channel Set")
                        .setDescription(`All staff submissions will now be sent to ${channel}.`)
                        .setColor(Colors.success),
                ],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (sub === "panel") {
            const config = await SubmitConfigRepository.get(guildId);

            if (!config?.reviewChannelId) {
                await interaction.reply({
                    content: "❌ Set the review channel first with `/setup-submit channel`.",
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const panelChannel = interaction.channel as TextChannel;

            const embed = new EmbedBuilder()
                .setTitle("📋 Staff Applications")
                .setDescription("No submission types are currently open for applications.\nCheck back later!")
                .setColor(Colors.error)
                .setTimestamp();

            const msg = await panelChannel.send({ embeds: [embed] });

            await SubmitConfigRepository.setPanel(guildId, panelChannel.id, msg.id);

            // If there are already open submission types, update the panel immediately
            const types = await SubmissionTypeRepository.list(guildId);
            if (types.some(t => t.isOpen)) {
                const updated = await SubmitConfigRepository.get(guildId);
                if (updated) await updatePanel(client, updated);
            }

            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("✅ Application Panel Posted")
                        .setDescription(`Panel posted in ${panelChannel}. Use \`/staff-submit open <department>\` to open applications.`)
                        .setColor(Colors.success),
                ],
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};
