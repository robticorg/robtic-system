import { Events } from "discord.js";
import type { EventConfig } from "@typings/event";
import type { BotClient } from "@core/bot-client";
import { onShortcutMessage } from "./functions/on-shortcut-message";
import { migrateLegacyShortcuts } from "./functions/migrate-legacy-shortcuts";
import { migrateChatCommands } from "./functions/migrate-chat-commands";
import { reportOrphanShortcuts } from "./functions/report-orphan-shortcuts";

export default [
    {
        name: Events.MessageCreate,
        execute: (message, client) => onShortcutMessage(message, client as BotClient),
    } satisfies EventConfig<Events.MessageCreate>,

    {
        name: Events.ClientReady,
        once: true,
        execute: async client => {
            await migrateLegacyShortcuts();
            await migrateChatCommands().catch(() => undefined);
            await reportOrphanShortcuts(client as BotClient);
        },
    } satisfies EventConfig<Events.ClientReady>,
];
