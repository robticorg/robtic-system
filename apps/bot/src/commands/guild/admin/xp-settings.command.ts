import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    AutocompleteInteraction,
    EmbedBuilder,
    ChannelType,
    MessageFlags,
} from "discord.js";
import type { BotClient } from "@core/bot-client";
import { XPSettingsRepository } from "@database/repositories";
import { COLORS } from "@constants";

import { L } from "@utils";
export default {
    scope: "guild",
    category: "Configuration",
    data: new SlashCommandBuilder()
        .setName("xp-settings")
        .setDescription("Configure XP system settings")

        .addSubcommand(sub =>
            sub
                .setName("add-channel")
                .setDescription("Add a channel with special XP/message handling")
                .addChannelOption(opt =>
                    opt.setName("channel").setDescription("Channel to add").addChannelTypes(ChannelType.GuildText).setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName("type").setDescription("Channel type").addChoices(
                        { name: "Excluded (no XP, no message count)", value: "excluded" },
                        { name: "Support", value: "support" },
                        { name: "Staff", value: "staff" },
                    ).setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("remove-channel")
                .setDescription("Remove a channel from special XP/message handling")
                .addStringOption(opt =>
                    opt.setName("type").setDescription("Channel type").addChoices(
                        { name: "Excluded (no XP, no message count)", value: "excluded" },
                        { name: "Support", value: "support" },
                        { name: "Staff", value: "staff" },
                    ).setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName("channel").setDescription("Channel to remove").setRequired(true).setAutocomplete(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("decay")
                .setDescription("Toggle XP decay system")
                .addBooleanOption(opt =>
                    opt.setName("enabled").setDescription("Enable or disable decay").setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("level-up-channel")
                .setDescription("Where level-ups are announced (leave empty to stop announcing them)")
                .addChannelOption(opt =>
                    opt.setName("channel").setDescription("Announcement channel").addChannelTypes(ChannelType.GuildText).setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("view")
                .setDescription("View current XP settings")
        ),

    requiredPermission: 80,

    async run(interaction: ChatInputCommandInteraction, _client: BotClient) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const guildId = interaction.guildId!;
        const sub = interaction.options.getSubcommand();

        if (sub === "add-channel") {
            const channel = interaction.options.getChannel("channel", true);
            const type = interaction.options.getString("type", true);

            if (type === "excluded") await XPSettingsRepository.addExcludedChannel(guildId, channel.id);
            else if (type === "support") await XPSettingsRepository.addSupportChannel(guildId, channel.id);
            else await XPSettingsRepository.addStaffChannel(guildId, channel.id);

            await interaction.editReply({
                content: type === "excluded"
                    ? L(`Added <#${channel.id}> to **excluded** channels: no XP and no message count there.`, `تمت إضافة <#${channel.id}> للرومات **المستثناة**: لا خبرة ولا عد رسائل فيها.`)
                    : L(`Added <#${channel.id}> as a **${type}** channel.`, `تمت إضافة <#${channel.id}> كروم **${type}**.`),
            });
        }

        else if (sub === "remove-channel") {
            const channelId = interaction.options.getString("channel", true);
            const type = interaction.options.getString("type", true);

            if (type === "excluded") await XPSettingsRepository.removeExcludedChannel(guildId, channelId);
            else if (type === "support") await XPSettingsRepository.removeSupportChannel(guildId, channelId);
            else await XPSettingsRepository.removeStaffChannel(guildId, channelId);

            await interaction.editReply({
                content: L(`Removed <#${channelId}> from **${type}** channels.`, `تم حذف <#${channelId}> من رومات **${type}**.`),
            });
        }

        else if (sub === "decay") {
            const enabled = interaction.options.getBoolean("enabled", true);
            await XPSettingsRepository.setDecayEnabled(guildId, enabled);

            await interaction.editReply({
                content: L(`XP decay is now **${enabled ? "enabled" : "disabled"}**.`, `نقص الخبرة بعدم النشاط صار **${enabled ? "مفعّل" : "مقفل"}**.`),
            });
        }

        else if (sub === "level-up-channel") {
            const channel = interaction.options.getChannel("channel");
            await XPSettingsRepository.setLevelUpChannel(guildId, channel?.id ?? null);

            await interaction.editReply({
                content: channel
                    ? L(`Level-ups will be announced in <#${channel.id}>.`, `ترقيات المستوى بتنعلن في <#${channel.id}>.`)
                    : L("Level-ups will no longer be announced.", "ترقيات المستوى ما عاد تنعلن."),
            });
        }

        else if (sub === "view") {
            const settings = await XPSettingsRepository.getOrCreate(guildId);
            const excludedChs = settings.excludedChannels.map(id => `<#${id}>`).join(", ").slice(0, 1000) || L("None", "لا يوجد");
            const supportChs = settings.supportChannels.map(id => `<#${id}>`).join(", ").slice(0, 1000) || L("None", "لا يوجد");
            const staffChs = settings.staffChannels.map(id => `<#${id}>`).join(", ").slice(0, 1000) || L("None", "لا يوجد");

            const embed = new EmbedBuilder()
                .setTitle(L("XP settings", "إعدادات الخبرة"))
                .addFields(
                    { name: L("Chat XP", "خبرة الشات"), value: L("Every channel, except Support and Excluded channels below", "كل الرومات، ما عدا رومات الدعم والمستثناة تحت") },
                    { name: L("Excluded channels", "الرومات المستثناة"), value: excludedChs },
                    { name: L("Support channels", "رومات الدعم"), value: supportChs },
                    { name: L("Staff channels", "رومات الإدارة"), value: staffChs },
                    { name: L("Inactivity decay", "نقص الخبرة بعدم النشاط"), value: settings.decayEnabled ? L("Yes", "نعم") : L("No", "لا"), inline: true },
                )
                .setColor(COLORS.info)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }
    },

    async autocomplete(interaction: AutocompleteInteraction, _client: BotClient) {
        const focused = interaction.options.getFocused(true);
        if (focused.name !== "channel") return interaction.respond([]);

        const guildId = interaction.guildId!;
        const type = interaction.options.getString("type");
        const settings = await XPSettingsRepository.get(guildId);
        if (!settings) return interaction.respond([]);

        let channelIds: string[] = [];
        if (type === "excluded") channelIds = settings.excludedChannels;
        else if (type === "support") channelIds = settings.supportChannels;
        else if (type === "staff") channelIds = settings.staffChannels;

        const guild = interaction.guild;
        const choices = channelIds
            .map(id => {
                const ch = guild?.channels.cache.get(id);
                return { name: ch ? `#${ch.name}` : `#unknown (${id})`, value: id };
            })
            .filter(c =>
                c.name.toLowerCase().includes(focused.value.toLowerCase())
            )
            .slice(0, 25);

        await interaction.respond(choices);
    },
};
