import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
    type GuildMember,
} from "discord.js";
import type { BotClient } from "@core/bot-client";
import { COLORS, CHECK_MESSAGES, CHECK_RESULT_LIMIT } from "@constants";
import { StreakRepository } from "@database/repositories";
import { hasFullPower } from "@shared/utils/access";

/** Administrators (and whitelisted super users, via hasFullPower) may run bulk member lookups. */
function isAllowed(member: GuildMember): boolean {
    return hasFullPower(member) || member.permissions.has(PermissionFlagsBits.Administrator);
}

export default {
    data: new SlashCommandBuilder()
        .setName("check")
        .setDescription("Look up members by a stat value (admin only)")
        .addSubcommand(sub =>
            sub.setName("streak")
                .setDescription("List every member currently on an exact streak")
                .addIntegerOption(opt =>
                    opt.setName("value")
                        .setDescription("The streak day-count to match (e.g. 5)")
                        .setRequired(true)
                        .setMinValue(1)
                )
        ),

    async run(interaction: ChatInputCommandInteraction, _client: BotClient) {
        const member = interaction.member as GuildMember | null;
        if (!member || !interaction.guildId) {
            await interaction.reply({ content: CHECK_MESSAGES.guildOnly, flags: MessageFlags.Ephemeral });
            return;
        }

        if (!isAllowed(member)) {
            await interaction.reply({ content: CHECK_MESSAGES.adminOnly, flags: MessageFlags.Ephemeral });
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "streak") {
            await runStreakCheck(interaction, interaction.guildId);
        }
    },
};

async function runStreakCheck(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
    const value = interaction.options.getInteger("value", true);
    if (!Number.isInteger(value) || value < 1) {
        await interaction.reply({ content: CHECK_MESSAGES.invalidValue, flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const records = await StreakRepository.findByCurrentStreak(guildId, value);

    if (records.length === 0) {
        await interaction.editReply({
            embeds: [new EmbedBuilder().setColor(COLORS.info).setDescription(CHECK_MESSAGES.streakNone(value))],
        });
        return;
    }

    const shown = records.slice(0, CHECK_RESULT_LIMIT);
    const lines = shown.map((record, index) => CHECK_MESSAGES.streakLine(index + 1, record.discordId));

    let description = `${CHECK_MESSAGES.streakSummary(records.length, value)}\n\n${lines.join("\n")}`;
    if (records.length > shown.length) {
        description += CHECK_MESSAGES.truncatedNote(shown.length, records.length);
    }

    const embed = new EmbedBuilder()
        .setTitle(CHECK_MESSAGES.streakTitle(value))
        .setDescription(description)
        .setColor(COLORS.activity)
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}
