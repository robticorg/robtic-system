import { ChannelType, MessageFlags, type ModalSubmitInteraction } from "discord.js";
import type { ComponentHandler } from "@typings/command";
import { MUSIC_CONFIG } from "@constants";
import { encryptToken, inspectBotToken, looksLikeBotToken, musicBotInviteUrl, musicTokenKey } from "@core/music";
import { MusicBotRepository } from "@database/repositories";
import { Logger } from "@logger";
import { MUSIC_CREATE_MODAL_ID, MUSIC_FIELDS } from "../utils/create-form";
import { grantVoicePermissions, startMusicBot } from "../engine/music-manager";

/**
 * `/music create` submitted. Everything is checked before anything is kept: the token must belong
 * to a real bot, not already be registered, and log in — a bot that can't start is never saved.
 * The token is encrypted before it reaches the database and never shown again.
 */
export const musicCreateModalHandler: ComponentHandler<ModalSubmitInteraction> = {
    customId: MUSIC_CREATE_MODAL_ID,

    async run(interaction: ModalSubmitInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const fail = (content: string) => interaction.editReply({ content });
        const guild = interaction.guild!;

        const key = musicTokenKey();
        if (!key) return void await fail("Music bots aren't set up on this bot yet: `MUSIC_TOKEN_KEY` is missing from its environment.");

        if (await MusicBotRepository.countByGuild(guild.id) >= MUSIC_CONFIG.maxBotsPerGuild) {
            return void await fail(`This server already has ${MUSIC_CONFIG.maxBotsPerGuild} music bots. Remove one with \`/bot remove\` first.`);
        }

        const token = interaction.fields.getTextInputValue(MUSIC_FIELDS.token).trim();
        const name = interaction.fields.getTextInputValue(MUSIC_FIELDS.name).trim();
        const channel = interaction.fields.getSelectedChannels(MUSIC_FIELDS.channel, true, [ChannelType.GuildVoice]).first();

        if (!channel) return void await fail("Pick a voice channel.");
        if (!looksLikeBotToken(token)) return void await fail("That doesn't look like a bot token.");

        const account = await inspectBotToken(token);
        if (!account) return void await fail("Discord didn't accept that token. Copy a fresh one from the Developer Portal (Bot → Reset Token).");
        if (account.botId === interaction.client.user.id) return void await fail("That's my own token — use a different bot.");

        const record = await MusicBotRepository.create({
            guildId: guild.id,
            botId: account.botId,
            applicationId: account.applicationId,
            name,
            voiceChannelId: channel.id,
            encryptedToken: encryptToken(token, key),
            createdBy: interaction.user.id,
        });
        if (!record) return void await fail(`**${account.username}** is already a music bot (here or in another server).`);

        const started = await startMusicBot(record);
        if (!started.ok) {
            await MusicBotRepository.delete(guild.id, record.botId);
            return void await fail(`I couldn't start it, so it wasn't added: ${started.problem}.`);
        }

        Logger.info(`Music bot ${name} (${account.botId}) created in ${guild.id} by ${interaction.user.id}`, "music");

        const inServer = await guild.members.fetch(account.botId).then(() => true, () => false);
        if (!inServer) {
            await interaction.editReply({
                content: [
                    `🎵 **${name}** is online. It isn't in this server yet — add it here:`,
                    musicBotInviteUrl(account.applicationId, guild.id),
                    "",
                    `It's invited with **no permissions**. Once it joins, I'll give it what it needs on <#${channel.id}> only, and it will join that channel.`,
                ].join("\n"),
                allowedMentions: { parse: [] },
            });
            return;
        }

        const problem = await grantVoicePermissions(guild, record);
        await interaction.editReply({
            content: problem
                ? `🎵 **${name}** is online, but ${problem}.`
                : `🎵 **${name}** is online and joining <#${channel.id}>. Play with \`ش <song>\` in that channel's chat.`,
            allowedMentions: { parse: [] },
        });
    },
};
