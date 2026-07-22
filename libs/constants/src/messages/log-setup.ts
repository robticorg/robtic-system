/**
 * Text for the /setup-log and /set-mod-channel modals.
 * Discord rejects a modal outright when a TextInput label exceeds 45 characters,
 * so these labels are kept short deliberately — the hint lives in the placeholder.
 */
export const LOG_SETUP_MESSAGES = {
    channelIdLabel: "Channel ID",
    channelIdPlaceholder: "Enter the channel ID (numbers only)",
    serverIdLabel: "Server ID (optional)",
    serverIdPlaceholder: "Leave empty to use this server",
    selectPlaceholder: "Select a log type to configure...",
    selectPrompt: "Select a log type to configure:",

    alreadyConfiguredTitle: "⚠️ Log Already Configured",
    alreadyConfiguredDescription: (label: string, serverName: string, channelMention: string) =>
        `**${label}** is already configured.\n\n**Server:** ${serverName}\n**Channel:** ${channelMention}`,
    overrideButtonLabel: "Override",
    overrideButtonEmoji: "⚠️",

    modalTitle: (label: string) => `Setup: ${label}`,
    botNotInServer: (serverId: string) => `❌ Bot is not in server \`${serverId}\`.`,
    channelNotFound: (channelId: string, guildName: string) =>
        `❌ Channel \`${channelId}\` not found or is not a text channel in **${guildName}**.`,

    configuredTitle: "✅ Log Channel Configured",
    updatedTitle: "🔄 Log Channel Updated",
    logTypeFieldName: "Log Type",
    serverFieldName: "Server",
    channelFieldName: "Channel",
    previousFieldName: "Previous",
} as const;

/** Discord's snowflake-length bounds for the modal's id inputs. */
export const SNOWFLAKE_INPUT_LENGTH = { min: 17, max: 20 } as const;
