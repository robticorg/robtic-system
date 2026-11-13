import { bilingual } from "@utils/lang-context";

/**
 * Text for the /setup-log and /set-mod-channel modals.
 * Discord rejects a modal outright when a TextInput label exceeds 45 characters,
 * so these labels are kept short deliberately — the hint lives in the placeholder.
 */
export const LOG_SETUP_MESSAGES = bilingual({
    channelIdLabel: "Channel ID",
    channelIdPlaceholder: "The channel ID (numbers only)",
    serverIdLabel: "Server ID (optional)",
    serverIdPlaceholder: "Leave empty to use this server",
    selectPlaceholder: "Pick a log type to set up…",
    selectPrompt: "Pick a log type to set up:",

    alreadyConfiguredTitle: "⚠️ This log is already set",
    alreadyConfiguredDescription: (label: string, serverName: string, channelMention: string) =>
        `**${label}** is already set.\n\n**Server:** ${serverName}\n**Channel:** ${channelMention}`,
    overrideButtonLabel: "Replace",
    overrideButtonEmoji: "⚠️",

    modalTitle: (label: string) => `Set up: ${label}`,
    botNotInServer: (serverId: string) => `❌ I'm not in server \`${serverId}\`.`,
    channelNotFound: (channelId: string, guildName: string) =>
        `❌ Channel \`${channelId}\` wasn't found in **${guildName}**, or isn't a text channel.`,

    configuredTitle: "✅ Log channel set",
    updatedTitle: "🔄 Log channel changed",
    logTypeFieldName: "Log type",
    serverFieldName: "Server",
    channelFieldName: "Channel",
    previousFieldName: "Before",
}, {
    channelIdLabel: "آيدي الروم",
    channelIdPlaceholder: "آيدي الروم (أرقام فقط)",
    serverIdLabel: "آيدي السيرفر (اختياري)",
    serverIdPlaceholder: "اتركه فاضي لاستخدام هذا السيرفر",
    selectPlaceholder: "اختر نوع اللوق…",
    selectPrompt: "اختر نوع اللوق اللي تبي تضبطه:",

    alreadyConfiguredTitle: "⚠️ هذا اللوق مضبوط من قبل",
    alreadyConfiguredDescription: (label: string, serverName: string, channelMention: string) =>
        `**${label}** مضبوط من قبل.\n\n**السيرفر:** ${serverName}\n**الروم:** ${channelMention}`,
    overrideButtonLabel: "استبدال",
    overrideButtonEmoji: "⚠️",

    modalTitle: (label: string) => `ضبط: ${label}`,
    botNotInServer: (serverId: string) => `❌ أنا مو موجود في السيرفر \`${serverId}\`.`,
    channelNotFound: (channelId: string, guildName: string) =>
        `❌ الروم \`${channelId}\` غير موجود في **${guildName}** أو ليس روم كتابي.`,

    configuredTitle: "✅ تم ضبط روم اللوق",
    updatedTitle: "🔄 تم تغيير روم اللوق",
    logTypeFieldName: "نوع اللوق",
    serverFieldName: "السيرفر",
    channelFieldName: "الروم",
    previousFieldName: "السابق",
});

/** Discord's snowflake-length bounds for the modal's id inputs. */
export const SNOWFLAKE_INPUT_LENGTH = { min: 17, max: 20 } as const;
