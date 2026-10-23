import { ChannelType, MessageFlags, type ModalSubmitInteraction } from "discord.js";
import type { ComponentHandler } from "@typings/command";
import { createMusicBot, musicBotInviteUrl } from "@core/music";
import { Logger } from "@logger";
import { grantVoicePermissions } from "../../music/utils/voice-permissions";
import { enableMinecraftBot } from "../lib/minecraft-api";
import { canManageMinecraftBot } from "../utils/can-manage-minecraft-bot";
import { BOT_CREATE_MODAL_ID, BOT_FIELDS, type BotType } from "../utils/forms";

/** A music bot: checked, saved encrypted and started by `@core/music`; the invite and channel permissions are done here. */
async function createMusic(interaction: ModalSubmitInteraction, token: string): Promise<void> {
    const guild = interaction.guild!;
    const name = interaction.fields.getTextInputValue(BOT_FIELDS.name).trim();
    const channel = interaction.fields.getSelectedChannels(BOT_FIELDS.channel, false, [ChannelType.GuildVoice])?.first();
    if (!name) return void await interaction.editReply({ content: "A music bot needs a **name** — fill in *Bot name* and try again." });
    if (!channel) return void await interaction.editReply({ content: "A music bot needs a **voice channel** — pick one and try again." });

    const result = await createMusicBot({
        guildId: guild.id,
        token,
        name,
        voiceChannelId: channel.id,
        createdBy: interaction.user.id,
        mainBotId: interaction.client.user.id,
    });
    if (!result.ok) return void await interaction.editReply({ content: result.problem });

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
}

/** The Minecraft bot: the token goes to the Minecraft API, which checks it, saves it encrypted and keeps it running. */
async function createMinecraft(interaction: ModalSubmitInteraction, token: string): Promise<void> {
    if (!(await canManageMinecraftBot(interaction.user.id))) {
        return void await interaction.editReply({ content: "Only the bot owner and super users can set up the Minecraft bot — there's one for the whole deployment." });
    }

    const response = await enableMinecraftBot({
        token,
        guildId: interaction.guildId!,
        createdBy: interaction.user.id,
        mainBotId: interaction.client.user.id,
    });
    if (!response.ok) return void await interaction.editReply({ content: response.problem });
    if (!response.data.ok) return void await interaction.editReply({ content: response.data.problem });

    const { bot } = response.data;
    Logger.info(`Minecraft bot ${bot.username} (${bot.botId}) enabled by ${interaction.user.id}`, "bots");

    const inServer = bot.botId ? await interaction.guild!.members.fetch(bot.botId).then(() => true, () => false) : false;
    await interaction.editReply({
        content: [
            `⛏️ **${bot.username}** is online on the Minecraft API, and starts again on its own whenever the API restarts.`,
            ...(inServer || !bot.inviteUrl ? [] : ["It isn't in this server yet — add it here:", bot.inviteUrl]),
            "",
            "Post the account panel with `/minecraft panel`. Turn on **Message Content Intent** in the Developer Portal for the chat bridge and `!ip`.",
        ].join("\n"),
        allowedMentions: { parse: [] },
    });
}

/** `/bot create` submitted: one form, routed by the picked type. */
export const botCreateModalHandler: ComponentHandler<ModalSubmitInteraction> = {
    customId: BOT_CREATE_MODAL_ID,

    async run(interaction: ModalSubmitInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const type = interaction.fields.getStringSelectValues(BOT_FIELDS.type)[0] as BotType | undefined;
        const token = interaction.fields.getTextInputValue(BOT_FIELDS.token);

        if (type === "music") return void await createMusic(interaction, token);
        if (type === "minecraft") return void await createMinecraft(interaction, token);
        await interaction.editReply({ content: "Pick which bot to create." });
    },
};
