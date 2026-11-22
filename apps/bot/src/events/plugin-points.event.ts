import { Events } from "discord.js";
import type { EventConfig } from "@typings/event";
import { startPluginPoints } from "../services/plugin-points";

/** Pays the Points that Robtic Rules plugins (run by the Robtic Engine) give, once the Gateway is connected. */
export default {
    name: Events.ClientReady,
    once: true,
    execute: client => startPluginPoints(client),
} satisfies EventConfig<Events.ClientReady>;
