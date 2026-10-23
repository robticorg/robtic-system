import {
    ChannelSelectMenuBuilder,
    ChannelType,
    LabelBuilder,
    ModalBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    TextInputBuilder,
    TextInputStyle,
} from "discord.js";

export const BOT_CREATE_MODAL_ID = "bots:create";
export const BOT_DELETE_MODAL_ID = "bots:delete";

export const BOT_FIELDS = {
    type: "bots-type",
    token: "bots-token",
    name: "bots-name",
    channel: "bots-channel",
    target: "bots-target",
} as const;

/** What `/bot create` can make. Each value is how the submit handler tells them apart. */
export const BOT_TYPES = {
    music: { label: "Music", emoji: "🎵", description: "Plays 24/7 in one voice channel on this server" },
    minecraft: { label: "Minecraft", emoji: "⛏️", description: "Linking, server status and chat bridge — runs on the Minecraft API" },
} as const;

export type BotType = keyof typeof BOT_TYPES;

/**
 * The `/bot create` form. One form for every type, because a modal can't change its fields after
 * a pick: name and voice channel are optional here and required on submit for a music bot only.
 */
export function buildBotCreateModal(): ModalBuilder {
    return new ModalBuilder()
        .setCustomId(BOT_CREATE_MODAL_ID)
        .setTitle("Create Bot")
        .addLabelComponents(
            new LabelBuilder()
                .setLabel("Which bot")
                .setStringSelectMenuComponent(new StringSelectMenuBuilder()
                    .setCustomId(BOT_FIELDS.type)
                    .setMinValues(1)
                    .setMaxValues(1)
                    .setRequired(true)
                    .addOptions(Object.entries(BOT_TYPES).map(([value, type]) => new StringSelectMenuOptionBuilder()
                        .setValue(value)
                        .setLabel(type.label)
                        .setEmoji(type.emoji)
                        .setDescription(type.description)))),
            new LabelBuilder()
                .setLabel("Bot token")
                .setDescription("From the Developer Portal → your bot → Reset Token. Stored encrypted.")
                .setTextInputComponent(new TextInputBuilder()
                    .setCustomId(BOT_FIELDS.token)
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMinLength(50)
                    .setMaxLength(100)),
            new LabelBuilder()
                .setLabel("Bot name (music)")
                .setDescription("Its nickname in this server — music bots only")
                .setTextInputComponent(new TextInputBuilder()
                    .setCustomId(BOT_FIELDS.name)
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
                    .setMaxLength(32)
                    .setPlaceholder("Robtic Music")),
            new LabelBuilder()
                .setLabel("Voice channel (music)")
                .setDescription("Where a music bot stays 24/7 and plays — its only channel")
                .setChannelSelectMenuComponent(new ChannelSelectMenuBuilder()
                    .setCustomId(BOT_FIELDS.channel)
                    .setChannelTypes(ChannelType.GuildVoice)
                    .setMinValues(0)
                    .setMaxValues(1)
                    .setRequired(false)),
        );
}

export interface DeletableBot {
    /** `music:<botId>` or `minecraft`. */
    value: string;
    label: string;
    description: string;
    emoji: string;
}

/** The `/bot delete` form: one pick from the bots that exist right now. */
export function buildBotDeleteModal(bots: readonly DeletableBot[]): ModalBuilder {
    return new ModalBuilder()
        .setCustomId(BOT_DELETE_MODAL_ID)
        .setTitle("Delete Bot")
        .addLabelComponents(
            new LabelBuilder()
                .setLabel("Which bot")
                .setDescription("It goes offline, leaves, and its saved token is deleted")
                .setStringSelectMenuComponent(new StringSelectMenuBuilder()
                    .setCustomId(BOT_FIELDS.target)
                    .setMinValues(1)
                    .setMaxValues(1)
                    .setRequired(true)
                    .addOptions(bots.slice(0, 25).map(bot => new StringSelectMenuOptionBuilder()
                        .setValue(bot.value)
                        .setLabel(bot.label.slice(0, 100))
                        .setDescription(bot.description.slice(0, 100))
                        .setEmoji(bot.emoji)))),
        );
}
