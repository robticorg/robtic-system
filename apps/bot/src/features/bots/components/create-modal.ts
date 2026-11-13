import { ChannelType, MessageFlags, type ModalSubmitInteraction } from "discord.js";
import type { ComponentHandler } from "@typings/command";
import { createMusicBot, musicBotInviteUrl } from "@core/music";
import { Logger } from "@logger";
import { grantVoicePermissions } from "../../music/utils/voice-permissions";
import { enableMinecraftBot } from "../lib/minecraft-api";
import { canManageMinecraftBot } from "../utils/can-manage-minecraft-bot";
import { BOT_CREATE_MODAL_ID, BOT_FIELDS, type BotType } from "../utils/forms";

import { L } from "@utils";
/** A music bot: checked, saved encrypted and started by `@core/music`; the invite and channel permissions are done here. */
async function createMusic(interaction: ModalSubmitInteraction, token: string): Promise<void> {
    const guild = interaction.guild!;
    const name = interaction.fields.getTextInputValue(BOT_FIELDS.name).trim();
    const channel = interaction.fields.getSelectedChannels(BOT_FIELDS.channel, false, [ChannelType.GuildVoice])?.first();
    if (!name) return void await interaction.editReply({ content: L("A music bot needs a **name**: fill in *Bot name* and try again.", "بوت الموسيقى يحتاج **اسم**: عبّي *Bot name* وحاول مرة ثانية.") });
    if (!channel) return void await interaction.editReply({ content: L("A music bot needs a **voice channel**: pick one and try again.", "بوت الموسيقى يحتاج **روم صوتي**: اختر واحد وحاول مرة ثانية.") });

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
                L(`It's invited with **no permissions**. Once it joins, I'll give it what it needs on <#${channel.id}> only, and it will join that channel.`, `ينضاف **بدون صلاحيات**. أول ما يدخل بعطيه اللي يحتاجه في <#${channel.id}> فقط، ويدخل الروم.`),
            ].join("\n"),
            allowedMentions: { parse: [] },
        });
        return;
    }

    const problem = await grantVoicePermissions(guild, bot);
    await interaction.editReply({
        content: problem
            ? `🎵 **${bot.name}** is online, but ${problem}.`
            : L(`🎵 **${bot.name}** is online and joining <#${channel.id}>. Play with \`play <song>\` in that channel's chat.`, `🎵 **${bot.name}** شغال ويدخل <#${channel.id}>. شغل أغنية بـ \`ش <الأغنية>\` في شات الروم.`),
        allowedMentions: { parse: [] },
    });
}

/** The Minecraft bot: the token goes to the Minecraft API, which checks it, saves it encrypted and keeps it running. */
async function createMinecraft(interaction: ModalSubmitInteraction, token: string): Promise<void> {
    if (!(await canManageMinecraftBot(interaction.user.id))) {
        return void await interaction.editReply({ content: L("Only the bot owner and super users can set up the Minecraft bot: there's one for everyone.", "تجهيز بوت ماينكرافت لمالك البوت والمستخدمين الخارقين فقط: هو واحد للكل.") });
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
            L(`⛏️ **${bot.username}** is online on the Minecraft API, and starts again on its own whenever the API restarts.`, `⛏️ **${bot.username}** شغال على Minecraft API، ويرجع يشتغل لحاله إذا انعاد تشغيل الـ API.`),
            ...(inServer || !bot.inviteUrl ? [] : [L("It isn't in this server yet. Add it here:", "مو موجود في السيرفر لين الحين. أضفه من هنا:"), bot.inviteUrl]),
            "",
            L("Post the account panel with `/minecraft panel`. Turn on **Message Content Intent** in the Developer Portal for the chat bridge and `!ip`.", "انشر لوحة الحساب بـ `/minecraft panel`. فعّل **Message Content Intent** في Developer Portal لربط الشات و `!ip`."),
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
        await interaction.editReply({ content: L("Pick which bot to create.", "اختر أي بوت تبي تنشئ.") });
    },
};
