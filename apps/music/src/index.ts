import mongoose from "mongoose";
import { connectDatabase } from "@database/connection";
import { startAllMusicBots, stopAllMusicBots } from "@core/music";
import { onShutdown, startInternalApi } from "@internal-api";
import { Logger } from "@logger";
import { musicRoutes } from "./routes";

/**
 * The music app: every music bot runs here, apart from the Gateway, so music keeps playing while
 * the main bot restarts or fails over. The Gateway creates, lists and removes bots through this
 * app's internal API (`MUSIC_API_URL`).
 *
 * Run exactly one: each music bot is its own Discord session, and two copies of this app would log
 * every music bot in twice.
 */
const SERVICE = "music";

if (!process.env.MONGODB_URI) {
    Logger.error("MONGODB_URI is not set", SERVICE);
    process.exit(1);
}

await connectDatabase(process.env.MONGODB_URI);

// Every music bot shares this process: one bot's stray error (a broken ffmpeg pipe, a voice
// socket hiccup) must never crash it and take all of them offline. The Gateway gets the same
// handlers from DiscordErrorHandler; this app has no main client, so it installs its own.
process.on("uncaughtException", err => Logger.error(`[UncaughtException] ${err}`, SERVICE));
process.on("unhandledRejection", err => Logger.error(`[UnhandledRejection] ${err}`, SERVICE));

// Log out every music bot first on shutdown (registered before the API's own steps).
onShutdown("music bots", () => stopAllMusicBots());

startInternalApi({
    service: SERVICE,
    port: Number(process.env.MUSIC_API_PORT) || 3006,
    routes: musicRoutes(),
    onStop: async () => {
        await mongoose.disconnect();
    },
});

await startAllMusicBots();
