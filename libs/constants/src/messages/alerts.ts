/** Status-webhook alert content for Discord client/gateway lifecycle events. */
export const ALERT_MESSAGES = {
    clientError: {
        title: "Discord Client Error",
        description: "The bot encountered a critical client error",
        color: 15158332,
    },
    gatewayDisconnect: {
        title: "Discord Gateway Disconnect",
        description: "Bot disconnected from Discord",
        color: 16776960,
    },
    gatewayReconnecting: {
        title: "Discord Gateway Reconnecting",
        description: "Bot is attempting to re-establish connection to Discord",
        color: 3447003,
    },
} as const;
