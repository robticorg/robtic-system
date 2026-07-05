import type { BotClient } from "@core/BotClient";
import { Events } from "discord.js";
import { Logger } from "@core/libs/logger";

let processHandlersRegistered = false;

export class DiscordErrorHandler {
    constructor(private client: BotClient) {}

    public init(): void {
        // uncaughtException/unhandledRejection are global process events, not per-client —
        // registering them once per bot means one real error gets logged once per bot instance.
        if (!processHandlersRegistered) {
            processHandlersRegistered = true;

            process.on("uncaughtException", (error) => {
                Logger.error(`[UncaughtException] ${error}`, "Process");
            });

            process.on("unhandledRejection", (error) => {
                Logger.error(`[UnhandledRejection] ${error}`, "Process");
            });
        }

        this.client.on(Events.Error, (err) => {
            const isMissingPermissions = (err as { code?: number }).code === 50013;
            if (isMissingPermissions) {
                Logger.warn(`[DiscordClientWarning] ${err}`, this.client.botName);
                return;
            }

            Logger.error(`[DiscordClientError] ${err}`, this.client.botName);
        });

        this.client.on(Events.ShardError, (err, shardId) => {
            Logger.error(`[Shard ${shardId} Error] ${err}`, this.client.botName);
        });
    }
}
