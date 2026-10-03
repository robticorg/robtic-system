import {
    ChannelSelectMenuBuilder,
    ChannelType,
    LabelBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} from "discord.js";

export const MUSIC_CREATE_MODAL_ID = "music:create";

export const MUSIC_FIELDS = {
    token: "music-token",
    name: "music-name",
    channel: "music-channel",
} as const;

/** The `/music create` form: the bot's token, its name, and its voice channel (voice channels only). */
export function buildMusicCreateModal(): ModalBuilder {
    return new ModalBuilder()
        .setCustomId(MUSIC_CREATE_MODAL_ID)
        .setTitle("Create Music Bot")
        .addLabelComponents(
            new LabelBuilder()
                .setLabel("Bot token")
                .setDescription("From the Developer Portal → your bot → Reset Token. Stored encrypted.")
                .setTextInputComponent(new TextInputBuilder()
                    .setCustomId(MUSIC_FIELDS.token)
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMinLength(50)
                    .setMaxLength(100)),
            new LabelBuilder()
                .setLabel("Bot name")
                .setDescription("Shown as its nickname in this server")
                .setTextInputComponent(new TextInputBuilder()
                    .setCustomId(MUSIC_FIELDS.name)
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(32)
                    .setPlaceholder("Robtic Music")),
            new LabelBuilder()
                .setLabel("Voice channel")
                .setDescription("Where it stays 24/7 and plays — its only channel")
                .setChannelSelectMenuComponent(new ChannelSelectMenuBuilder()
                    .setCustomId(MUSIC_FIELDS.channel)
                    .setChannelTypes(ChannelType.GuildVoice)
                    .setMinValues(1)
                    .setMaxValues(1)
                    .setRequired(true)),
        );
}
