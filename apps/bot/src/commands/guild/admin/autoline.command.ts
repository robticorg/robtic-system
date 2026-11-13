import {
    SlashCommandBuilder,
    type ChatInputCommandInteraction,
    type AutocompleteInteraction,
    EmbedBuilder,
    MessageFlags,
    ChannelType,
    PermissionFlagsBits,
    type GuildMember,
} from "discord.js";
import { COLORS, SUPER_ADMIN_ID } from "@constants";
import { ServerConfigRepository } from "@database/repositories";

import { L } from "@utils";
/**
 * `/autoline add|remove channel:` — channels (text or announcement) where every message gets the
 * line image (`/setline`) posted after it and a reaction. Was `/line add|remove`.
 *
 * Administrators only. Hidden from everyone else in Discord, and checked again here, because the
 * shared permission guard lets lead staff and command-access grants through before it gets this far.
 */
export default {
    scope: "guild",
    category: "Configuration",
    data: new SlashCommandBuilder()
        .setName("autoline")
        .setDescription("Channels where every message gets the line image after it")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName("add")
                .setDescription("Post the line after every message in a channel")
                .addChannelOption(opt =>
                    opt.setName("channel")
                        .setDescription("A text or announcement channel")
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName("remove")
                .setDescription("Stop posting the line in a channel")
                .addStringOption(opt =>
                    opt.setName("channel")
                        .setDescription("The auto-line channel to remove")
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        ),

    requiredPermission: 100,

    async autocomplete(interaction: AutocompleteInteraction) {
        if (!interaction.guildId) {
            await interaction.respond([]);
            return;
        }

        const focused = interaction.options.getFocused().toLowerCase();
        const channelIds = await ServerConfigRepository.getLineChannels(interaction.guildId);

        const choices = channelIds
            .map(id => {
                const channel = interaction.guild?.channels.cache.get(id);
                return { name: channel ? `#${channel.name}` : id, value: id };
            })
            .filter(c => c.name.toLowerCase().includes(focused) || c.value.includes(focused));

        await interaction.respond(choices.slice(0, 25));
    },

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!interaction.guildId) {
            await interaction.editReply({ content: L("❌ This command can only be used in a server.", "❌ هذا الأمر يعمل داخل السيرفر فقط.") });
            return;
        }

        const member = interaction.member as GuildMember | null;
        if (interaction.user.id !== SUPER_ADMIN_ID && !member?.permissions.has(PermissionFlagsBits.Administrator)) {
            await interaction.editReply({ content: L("❌ Only Administrators can manage auto-line channels.", "❌ إدارة رومات الخط التلقائي للأدمن فقط.") });
            return;
        }

        if (interaction.options.getSubcommand() === "add") {
            const channel = interaction.options.getChannel("channel", true);
            await ServerConfigRepository.addLineChannel(interaction.guildId, channel.id);

            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle(L("✅ Auto-line channel added", "✅ تمت إضافة روم خط تلقائي"))
                    .setColor(COLORS.success)
                    .setDescription(L(`Every message sent in <#${channel.id}> will now get the line image after it.`, `كل رسالة في <#${channel.id}> بيجي بعدها الخط.`))
                    .setTimestamp()],
            });
            return;
        }

        const channelId = interaction.options.getString("channel", true);
        const before = await ServerConfigRepository.getLineChannels(interaction.guildId);
        await ServerConfigRepository.removeLineChannel(interaction.guildId, channelId);

        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setTitle(before.includes(channelId) ? L("✅ Auto-line channel removed", "✅ تم حذف روم الخط التلقائي") : L("Not an auto-line channel", "ليس روم خط تلقائي"))
                .setColor(before.includes(channelId) ? COLORS.success : COLORS.warning)
                .setDescription(before.includes(channelId)
                    ? L(`<#${channelId}> will no longer get the line image.`, `<#${channelId}> ما عاد يجيه الخط.`)
                    : L(`<#${channelId}> wasn't an auto-line channel.`, `<#${channelId}> ما كان روم خط تلقائي.`))
                .setTimestamp()],
        });
    },
};
