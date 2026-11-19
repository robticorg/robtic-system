import { Events } from "discord.js";
import type { EventConfig } from "@typings/event";
import { startAutomodModeration } from "../services/automod-moderation";

/** Records the warns / mutes / jails the Robtic Engine (AutoMod) hands over, once the Gateway is connected. */
export default {
    name: Events.ClientReady,
    once: true,
    execute: client => startAutomodModeration(client),
} satisfies EventConfig<Events.ClientReady>;
