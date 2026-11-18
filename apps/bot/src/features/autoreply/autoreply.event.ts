import { Events } from "discord.js";
import type { EventConfig } from "@typings/event";
import type { BotClient } from "@core/bot-client";
import { onAutoReplyMessage } from "./functions/on-auto-reply-message";

export default [
    {
        name: Events.MessageCreate,
        execute: (message, client) => onAutoReplyMessage(message, client as BotClient),
    } satisfies EventConfig<Events.MessageCreate>,
];
