import { MessageFlags, PermissionFlagsBits, PermissionsBitField } from "discord.js";
import type { CommandConfig } from "@typings/command";
import type { CommandInteractionLike } from "@typings/feature";
import { buildFeatureCommands } from "@core/features";
import { encryptToken, inspectBotToken, looksLikeBotToken, musicTokenKey } from "@core/music";
import { MusicBotRepository } from "@database/repositories";
import { Logger } from "@logger";
import { competitionFeature } from "./competition";
import { CompetitionBot } from "./lib/models";
import { startCompetitionBot } from "./lib/runtime";

/** What the competition bot needs: post (with files and its emojis), edit its posts, delete the command messages. */
const INVITE_PERMISSIONS = new PermissionsBitField([
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.UseExternalEmojis,
    PermissionFlagsBits.ManageMessages,
]).bitfield;

function inviteUrl(applicationId: string, guildId: string): string {
    const params = new URLSearchParams({
        client_id: applicationId,
        scope: "bot",
        permissions: INVITE_PERMISSIONS.toString(),
        guild_id: guildId,
        disable_guild_select: "true",
    });
    return `https://discord.com/oauth2/authorize?${params}`;
}

/**
 * TEMP — `/create bot token:`. Checks the token, saves it encrypted (same key as music bots) and
 * logs the bot in. Running it again replaces the bot but keeps the competition (posts, votes).
 */
async function createBot(interaction: CommandInteractionLike): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const guild = interaction.guild!;
    const fail = (content: string) => interaction.editReply({ content });

    const key = musicTokenKey();
    if (!key) return void await fail("`MUSIC_TOKEN_KEY` is missing from the bot's environment — it encrypts the token.");

    const token = interaction.options.getString("token", true).trim();
    if (!looksLikeBotToken(token)) return void await fail("That doesn't look like a bot token.");

    const account = await inspectBotToken(token);
    if (!account) return void await fail("Discord didn't accept that token. Copy a fresh one from the Developer Portal (Bot → Reset Token).");
    if (account.botId === interaction.client.user.id) return void await fail("That's my own token — use a different bot.");
    if (await MusicBotRepository.findByBotId(account.botId)) return void await fail(`**${account.username}** is already a music bot — use another bot.`);
    const elsewhere = await CompetitionBot.findOne({ botId: account.botId, guildId: { $ne: guild.id } });
    if (elsewhere) return void await fail(`**${account.username}** is already the competition bot of another server.`);

    const record = await CompetitionBot.findOneAndUpdate(
        { guildId: guild.id },
        { $set: { botId: account.botId, applicationId: account.applicationId, encryptedToken: encryptToken(token, key), createdBy: interaction.user.id } },
        { upsert: true, new: true },
    );

    const started = await startCompetitionBot(record);
    if (!started.ok) return void await fail(`Saved, but it didn't log in: ${started.problem}. I'll keep retrying every few minutes. Make sure **Message Content Intent** is on in the Developer Portal.`);

    Logger.info(`Competition bot ${account.username} (${account.botId}) set for ${guild.id} by ${interaction.user.id}`, "competition");
    const inServer = await guild.members.fetch(account.botId).then(() => true, () => false);
    await interaction.editReply({
        content: inServer
            ? `🏆 **${account.username}** is online. Use \`!help\` in any channel to see its commands.`
            : [`🏆 **${account.username}** is online. Add it to this server:`, inviteUrl(account.applicationId, guild.id), "", "Then use `!help` to see its commands."].join("\n"),
        allowedMentions: { parse: [] },
    });
}

export default buildFeatureCommands(competitionFeature, {
    create: async (interaction: CommandInteractionLike) => {
        if (!interaction.guild) return;
        if (interaction.options.getSubcommand() === "bot") await createBot(interaction);
    },
}) satisfies CommandConfig[];
