import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
    ChannelType,
    type ChatInputCommandInteraction,
    type GuildTextBasedChannel,
} from "discord.js";
import { ChatUtils } from "@bot/utils/moderation/chat";
import { STAFF_TIER_THRESHOLDS, CHAT_MESSAGES } from "@constants";

export type ChannelToolName = keyof typeof ChatUtils;

/**
 * One channel tool as its own slash command (/lock, /unlock, /hide, /unhide, /slowmode, /clear). They were the
 * subcommands of /chat; each is now a command so it can be granted, turned off and given shortcuts on its own. The
 * work itself is ChatUtils, the same code their shortcuts (`l`, `c 10`…) run.
 */
export function channelTool(name: ChannelToolName, description: string, extra?: (b: SlashCommandBuilder) => void) {
    const data = new SlashCommandBuilder()
        .setName(name)
        .setDescription(description)
        .setDefaultMemberPermissions(name === "clear" ? PermissionFlagsBits.ManageMessages : PermissionFlagsBits.ManageChannels);
    extra?.(data);
    data.addChannelOption(opt =>
        opt.setName("channel")
            .setDescription("Channel to act on. Defaults to this one.")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildVoice)
            .setRequired(false));

    return {
        scope: "guild",
        category: "Moderation",
        data,
        requiredPermission: STAFF_TIER_THRESHOLDS.staff,

        async run(interaction: ChatInputCommandInteraction) {
            if (!interaction.guild || !interaction.channel) {
                await interaction.reply({ content: CHAT_MESSAGES.guildChannelOnly, flags: MessageFlags.Ephemeral });
                return;
            }
            const guild = interaction.guild;
            const channel = (interaction.options.getChannel("channel") ?? interaction.channel) as GuildTextBasedChannel;

            // Clearing this channel would delete the bot's own "thinking…" reply with everything else; a private reply
            // isn't in the channel, so it survives.
            const clearingHere = name === "clear" && channel.id === interaction.channelId;
            await interaction.deferReply(clearingHere ? { flags: MessageFlags.Ephemeral } : undefined);

            try {
                const msg = name === "slowmode"
                    ? await ChatUtils.slowmode(channel, interaction.options.getString("duration", true))
                    : name === "clear"
                        ? await ChatUtils.clear(channel, interaction.options.getInteger("amount") ?? 100)
                        : await ChatUtils[name](channel, guild);

                if (!msg) {
                    await interaction.editReply({ content: CHAT_MESSAGES.actionFailed });
                    return;
                }
                await interaction.editReply({ content: msg });
                if (name === "clear" && !clearingHere) setTimeout(() => void interaction.deleteReply().catch(() => {}), 5000);
            } catch (error) {
                console.error(error);
                await interaction.editReply({ content: CHAT_MESSAGES.actionFailed }).catch(() => {});
            }
        },
    };
}
