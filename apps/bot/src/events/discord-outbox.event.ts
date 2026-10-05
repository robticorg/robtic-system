import { Events } from "discord.js";
import type { EventConfig } from "@typings/event";
import { startDiscordOutbox } from "../services/discord-outbox";

/** Posts what workers queue for Discord (announcements), once the Gateway is connected. */
export default {
    name: Events.ClientReady,
    once: true,
    execute: client => startDiscordOutbox(client),
} satisfies EventConfig<Events.ClientReady>;
