/**
 * Publishes slash commands without starting the bot: no gateway login, no event listeners.
 *
 * The bot also publishes on startup, but that only happens when its container is recreated, and a
 * failure there is logged and forgotten. The deploy workflow runs this after every push so a
 * failed or skipped registration shows up as a red job instead of stale commands.
 *
 *   bun --preload ./libs/shared/src/preload.ts apps/bot/src/register-commands.ts
 *
 * Exits non-zero when any route failed to publish.
 */
import { Routes } from "discord.js";
import mongoose from "mongoose";
import { BotClient } from "@core/bot-client";
import { loadModules } from "@core/loader/load-modules";
import { publishCommands } from "@core/registration";
import { connectDatabase } from "@database/connection";
import { Logger } from "@logger";
import { BOT_DEFINITION, getMainBotToken } from "@config";

let ok = false;

try {
    // The admin guild id lives in MongoDB.
    await connectDatabase(process.env.MONGODB_URI!);

    const client = new BotClient(BOT_DEFINITION.name, getMainBotToken(), BOT_DEFINITION.intents);
    await loadModules(client, import.meta.dir, { skipEvents: true });

    const rest = client.rest_();
    const application = await rest.get(Routes.currentApplication()) as { id: string };

    ok = await publishCommands(rest, application.id, client.commands, client.botName);
} catch (error) {
    Logger.error(`Command registration failed: ${error}`, BOT_DEFINITION.name);
} finally {
    await mongoose.disconnect().catch(() => {});
}

process.exit(ok ? 0 : 1);
