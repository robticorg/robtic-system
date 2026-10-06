import { ChannelType, MessageFlags, type ModalSubmitInteraction } from "discord.js";
import type { ComponentHandler } from "@typings/command";
import { musicBotInviteUrl } from "@core/music";
import { InternalApiError, unavailableMessage } from "@internal-client";
import { MUSIC_CREATE_MODAL_ID, MUSIC_FIELDS } from "../utils/create-form";
import { musicBackend } from "../utils/music-backend";
import { grantVoicePermissions } from "../utils/voice-permissions";

/**
 * `/music create` submitted. The music service (the music app's API, or this process locally)
 * checks the token, saves it encrypted and logs the bot in — a bot that can't start is never
 * saved. What needs the main bot stays here: the invite link and the voice-channel permissions.
 */
export const musicCreateModalHandler: ComponentHandler<ModalSubmitInteraction> = {
    customId: MUSIC_CREATE_MODAL_ID,

    async run(interaction: ModalSubmitInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const fail = (content: string) => interaction.editReply({ content });
        const guild = interaction.guild!;

        const channel = interaction.fields.getSelectedChannels(MUSIC_FIELDS.channel, true, [ChannelType.GuildVoice]).first();
        if (!channel) return void await fail("Pick a voice channel.");

        let result;
        try {
            result = await musicBackend.create({
                guildId: guild.id,
                token: interaction.fields.getTextInputValue(MUSIC_FIELDS.token),
                name: interaction.fields.getTextInputValue(MUSIC_FIELDS.name),
                voiceChannelId: channel.id,
                createdBy: interaction.user.id,
                mainBotId: interaction.client.user.id,
            });
        } catch (err) {
            if (err instanceof InternalApiError) return void await fail(unavailableMessage("music"));
            throw err;
        }
        if (!result.ok) return void await fail(result.problem);

        const { bot } = result;
        const inServer = await guild.members.fetch(bot.botId).then(() => true, () => false);
        if (!inServer) {
            await interaction.editReply({
                content: [
                    `🎵 **${bot.name}** is online. It isn't in this server yet — add it here:`,
                    musicBotInviteUrl(bot.applicationId, guild.id),
                    "",
                    `It's invited with **no permissions**. Once it joins, I'll give it what it needs on <#${channel.id}> only, and it will join that channel.`,
                ].join("\n"),
                allowedMentions: { parse: [] },
            });
            return;
        }

        const problem = await grantVoicePermissions(guild, bot);
        await interaction.editReply({
            content: problem
                ? `🎵 **${bot.name}** is online, but ${problem}.`
                : `🎵 **${bot.name}** is online and joining <#${channel.id}>. Play with \`ش <song>\` in that channel's chat.`,
            allowedMentions: { parse: [] },
        });
    },
};
