import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    ChannelType,
    MessageFlags,
} from "discord.js";
import type { BotClient } from "@core/BotClient";
import { StreakSettingsRepository, StreakRepository, StreakRecoveryRepository } from "@database/repositories";
import { Colors, STREAK_CONFIG } from "@core/config";
import { formatDuration } from "@core/utils";

export default {
    data: new SlashCommandBuilder()
        .setName("streak-config")
        .setDescription("Configure the streak system for this server")

        .addSubcommandGroup(group =>
            group
                .setName("channel")
                .setDescription("Manage streak channels")
                .addSubcommand(sub =>
                    sub
                        .setName("add")
                        .setDescription("Add a streak channel")
                        .addChannelOption(opt =>
                            opt.setName("channel").setDescription("Channel to add").addChannelTypes(ChannelType.GuildText).setRequired(true)
                        )
                )
                .addSubcommand(sub =>
                    sub
                        .setName("remove")
                        .setDescription("Remove a streak channel")
                        .addChannelOption(opt =>
                            opt.setName("channel").setDescription("Channel to remove").addChannelTypes(ChannelType.GuildText).setRequired(true)
                        )
                )
                .addSubcommand(sub =>
                    sub.setName("list").setDescription("List configured streak channels")
                )
        )
        .addSubcommandGroup(group =>
            group
                .setName("reminder")
                .setDescription("Manage streak expiry reminders")
                .addSubcommand(sub =>
                    sub
                        .setName("default")
                        .setDescription("Enable or disable expiry reminders for this server")
                        .addBooleanOption(opt =>
                            opt.setName("enabled").setDescription("Whether reminders should be sent").setRequired(true)
                        )
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("settings")
                .setDescription("View or update streak settings")
                .addIntegerOption(opt =>
                    opt.setName("min-length").setDescription("Minimum message length to count towards a streak").setMinValue(1).setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("return")
                .setDescription("Restore an expired streak (must be within the recovery window)")
                .addUserOption(opt =>
                    opt.setName("user").setDescription("The user to restore").setRequired(true)
                )
        ),

    requiredPermission: 80,

    async run(interaction: ChatInputCommandInteraction, _client: BotClient) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const guildId = interaction.guildId!;
        const group = interaction.options.getSubcommandGroup(false);
        const sub = interaction.options.getSubcommand();

        if (group === "channel") {
            if (sub === "add") {
                const channel = interaction.options.getChannel("channel", true);
                await StreakSettingsRepository.addChannel(guildId, channel.id);
                await interaction.editReply({ content: `Added <#${channel.id}> as a streak channel.` });
                return;
            }

            if (sub === "remove") {
                const channel = interaction.options.getChannel("channel", true);
                await StreakSettingsRepository.removeChannel(guildId, channel.id);
                await interaction.editReply({ content: `Removed <#${channel.id}> from streak channels.` });
                return;
            }

            const settings = await StreakSettingsRepository.getOrCreate(guildId);
            const list = settings.channels.length ? settings.channels.map(id => `<#${id}>`).join(", ") : "None";
            await interaction.editReply({
                embeds: [new EmbedBuilder().setTitle("Streak Channels").setDescription(list).setColor(Colors.info)],
            });
            return;
        }

        if (group === "reminder") {
            const enabled = interaction.options.getBoolean("enabled", true);
            await StreakSettingsRepository.setRemindersEnabled(guildId, enabled);
            await interaction.editReply({ content: `Streak expiry reminders are now **${enabled ? "enabled" : "disabled"}**.` });
            return;
        }

        if (sub === "settings") {
            const minLength = interaction.options.getInteger("min-length");
            let settings = await StreakSettingsRepository.getOrCreate(guildId);
            if (minLength !== null) {
                settings = await StreakSettingsRepository.setMinMessageLength(guildId, minLength);
            }

            const embed = new EmbedBuilder()
                .setTitle("Streak Settings")
                .addFields(
                    { name: "Channels", value: settings.channels.length ? settings.channels.map(id => `<#${id}>`).join(", ") : "None" },
                    { name: "Reminders", value: settings.remindersEnabled ? "Enabled" : "Disabled", inline: true },
                    { name: "Min Message Length", value: `${settings.minMessageLength}`, inline: true },
                    { name: "Claim Window", value: formatDuration(STREAK_CONFIG.claimWindowMs), inline: true },
                    { name: "Expiry Window", value: formatDuration(STREAK_CONFIG.expireWindowMs), inline: true },
                    { name: "Reminder Threshold", value: formatDuration(STREAK_CONFIG.reminderThresholdMs), inline: true },
                    { name: "Recovery Window", value: formatDuration(STREAK_CONFIG.recoveryWindowMs), inline: true },
                )
                .setColor(Colors.info)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            return;
        }

        // sub === "return"
        const user = interaction.options.getUser("user", true);
        const recovery = await StreakRecoveryRepository.find(user.id, guildId);

        if (!recovery) {
            await interaction.editReply({ content: `No recoverable streak found for ${user}.` });
            return;
        }

        const withinWindow = Date.now() - recovery.expiredAt.getTime() <= STREAK_CONFIG.recoveryWindowMs;
        if (!withinWindow) {
            await interaction.editReply({ content: `${user}'s recovery window has expired.` });
            return;
        }

        await StreakRepository.restore(user.id, guildId, recovery.currentStreak, recovery.bestStreak);
        await StreakRecoveryRepository.delete(user.id, guildId);

        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setTitle("✅ Streak Restored")
                .setColor(Colors.success)
                .setDescription(`Restored ${user}'s streak to **${recovery.currentStreak}** (best **${recovery.bestStreak}**).`)],
        });
    },
};
