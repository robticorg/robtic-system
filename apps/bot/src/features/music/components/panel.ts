import {
    LabelBuilder,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    type ButtonInteraction,
    type ModalSubmitInteraction,
} from "discord.js";
import type { ComponentHandler } from "@typings/command";
import { MUSIC_CONFIG } from "@constants";
import { MusicSettingsRepository } from "@database/repositories";
import { musicBotsInGuild, pickBot, pickProblem } from "@core/music";
import { Logger } from "@logger";
import { L } from "@utils";

/**
 * The music control panel: a message the RobTic Music dashboard posts (with the main bot) in a channel of the
 * server's choice. Its buttons act on the music bot of the voice channel the person is in:
 *
 *   Play  → a form for a song name or link; the channel's bot plays it (a free roaming bot joins if the channel has
 *           none). The now-playing card goes to that voice channel's chat.
 *   Pause / Resume / Skip / Stop / Volume → that channel's bot.
 *
 * Everyone in the voice channel may use it (no DJ role). Answers are only visible to the person who pressed.
 */

export const MUSIC_PANEL_PREFIX = "music-panel:";
export const MUSIC_PANEL_ACTIONS = ["play", "pause", "resume", "skip", "stop", "vdown", "vup"] as const;
export type MusicPanelAction = (typeof MUSIC_PANEL_ACTIONS)[number];
const MODAL_ID = `${MUSIC_PANEL_PREFIX}modal`;
const QUERY_FIELD = "query";

const voiceOf = (i: ButtonInteraction | ModalSubmitInteraction) => (i.inCachedGuild() ? i.member.voice.channelId : null);
const ephemeral = (content: string) => ({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } }) as const;

async function panelOn(guildId: string): Promise<boolean> {
    return (await MusicSettingsRepository.get(guildId)).panel;
}

export const musicPanelButtonHandler: ComponentHandler<ButtonInteraction> = {
    customId: new RegExp(`^${MUSIC_PANEL_PREFIX}(${MUSIC_PANEL_ACTIONS.join("|")})$`),
    feature: "music",

    async run(interaction: ButtonInteraction) {
        const guildId = interaction.guildId!;
        if (!(await panelOn(guildId))) return interaction.reply(ephemeral(L("The music panel is turned off on this server.", "لوحة التحكم بالموسيقى معطّلة في هذا السيرفر.")));

        const action = interaction.customId.slice(MUSIC_PANEL_PREFIX.length) as MusicPanelAction;
        const bots = musicBotsInGuild(guildId);
        const voice = voiceOf(interaction);
        const pick = pickBot(bots, voice, { starting: action === "play" });
        if (!pick.ok) return interaction.reply(ephemeral(pickProblem(pick.reason, bots)));
        const bot = pick.bot;

        if (action === "play") {
            const input = new TextInputBuilder()
                .setCustomId(QUERY_FIELD)
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(300)
                .setPlaceholder(L("A song name, or a YouTube / Spotify / SoundCloud link", "اسم الأغنية، أو رابط YouTube / Spotify / SoundCloud"));
            const modal = new ModalBuilder()
                .setCustomId(MODAL_ID)
                .setTitle(L("Play music", "تشغيل الموسيقى"))
                .addLabelComponents(new LabelBuilder().setLabel(L("Song or link", "الأغنية أو الرابط")).setTextInputComponent(input));
            return interaction.showModal(modal);
        }

        switch (action) {
            case "pause":
                return interaction.reply(ephemeral(bot.pause() ? L("⏸️ Paused.", "⏸️ تم الإيقاف المؤقت.") : L("Nothing is playing.", "لا يوجد تشغيل حالياً.")));
            case "resume":
                return interaction.reply(ephemeral(bot.resume() ? L("▶️ Resumed.", "▶️ تمت المتابعة.") : L("Nothing is paused.", "لا يوجد تشغيل متوقف مؤقتاً.")));
            case "skip":
                return interaction.reply(ephemeral(bot.skip() ? L("⏭️ Skipped.", "⏭️ تم التخطي.") : L("Nothing to skip to.", "لا توجد أغنية تالية.")));
            case "stop":
                return interaction.reply(ephemeral((await bot.stop()) ? L("⏹️ Stopped and cleared the queue.", "⏹️ تم إيقاف التشغيل ومسح القائمة.") : L("Nothing is playing.", "لا يوجد تشغيل حالياً.")));
            case "vdown":
            case "vup": {
                const v = bot.changeVolume(action === "vup" ? MUSIC_CONFIG.volumeStep : -MUSIC_CONFIG.volumeStep);
                return interaction.reply(ephemeral(L(`🔊 Volume: **${v}%**`, `🔊 مستوى الصوت: **${v}%**`)));
            }
        }
    },
};

export const musicPanelModalHandler: ComponentHandler<ModalSubmitInteraction> = {
    customId: MODAL_ID,
    feature: "music",

    async run(interaction: ModalSubmitInteraction) {
        const guildId = interaction.guildId!;
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (!(await panelOn(guildId))) return interaction.editReply({ content: L("The music panel is turned off on this server.", "لوحة التحكم بالموسيقى معطّلة في هذا السيرفر.") });

        const query = interaction.fields.getTextInputValue(QUERY_FIELD).trim();
        // They may have moved while typing: pick again for where they are now.
        const bots = musicBotsInGuild(guildId);
        const voice = voiceOf(interaction);
        const pick = pickBot(bots, voice, { starting: true });
        if (!pick.ok) return interaction.editReply({ content: pickProblem(pick.reason, bots), allowedMentions: { parse: [] } });

        try {
            const { track, queued } = await pick.bot.play(query, { requestedBy: interaction.user.username, voiceChannelId: voice!, textChannelId: voice! });
            return interaction.editReply({
                content: queued
                    ? L(`➕ Added to the queue: **${track.title}**`, `➕ تمت الإضافة إلى القائمة: **${track.title}**`)
                    : L(`▶️ Playing **${track.title}** in <#${voice}>.`, `▶️ جارٍ تشغيل **${track.title}** في <#${voice}>.`),
                allowedMentions: { parse: [] },
            });
        } catch (e) {
            Logger.warn(`panel play: ${(e as Error).message}`, "music");
            return interaction.editReply({ content: `❌ ${(e as Error).message}`, allowedMentions: { parse: [] } });
        }
    },
};
