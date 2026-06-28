import { Collection, GatewayIntentBits, Partials } from "discord.js";

import { BotClient } from "@core/BotClient";
import { ModuleLoader } from "@core/ModuleLoader";
import { DiscordErrorHandler } from "@core/handlers";
import { Logger } from "@core/libs";
import { BOT_DEFINITIONS } from "@core/config";

export class ClientManager {
    private clients = new Collection<BotName, BotClient>();
    private startTimes = new Collection<BotName, number>();
    private static instance: ClientManager;

    private constructor() {}

    static getInstance(): ClientManager {
        if (!ClientManager.instance) {
            ClientManager.instance = new ClientManager();
        }
        return ClientManager.instance;
    }

    async initializeBot(definition: BotDefinition<GatewayIntentBits, Partials>): Promise<BotClient> {
        const token = process.env[definition.tokenKey];
        if(!token) return Promise.reject(new Error(`Token for bot "${definition.name}" not found in environment variables`));

        const client = new BotClient(definition.name, token, definition.intents, definition.partials);

        const errorHandler = new DiscordErrorHandler(client);
        errorHandler.init();

        const loader = new ModuleLoader(client);
        const botDir = `${import.meta.dir}/../bot/${definition.name}`;
        const sharedDir = `${import.meta.dir}/../bot/shared`;

        await loader.loadCommands(`${botDir}/commands`);
        await loader.loadEvents(`${botDir}/events`);
        await loader.loadEvents(`${sharedDir}/events`);
        await loader.loadComponents(`${botDir}/components`);

        client.loadedModules.push(definition.name);

        this.clients.set(definition.name, client);
        return client;
    }

    async startBot(name: BotName): Promise<void> {
        const client = this.clients.get(name);
        if (!client) {
            Logger.error(`Bot "${name}" not initialized`, "ClientManager");
            return;
        }

        await client.start();
        this.startTimes.set(name, Date.now());

        client.once("clientReady", async () => {
            await client.registerSlashCommands();
        });
    }

    async stopBot(name: BotName): Promise<void> {
        const client = this.clients.get(name);
        if (!client) return;

        client.destroy();
        this.clients.delete(name);
        this.startTimes.delete(name);
        Logger.info(`Bot "${name}" stopped`, "ClientManager");
    }

    async startAll(): Promise<void> {
        Logger.info("Initializing all bots...", "ClientManager");

        for (const definition of BOT_DEFINITIONS) {
            try {
                await this.initializeBot(definition);
                await this.startBot(definition.name);
            } catch (err) {
                Logger.error(`Failed to start bot "${definition.name}": ${err}`, "ClientManager");
            }
        }

        Logger.success(`All bots initialized (${this.clients.size} active)`, "ClientManager");
    }

    async stopAll(): Promise<void> {
        for (const [name] of this.clients) {
            await this.stopBot(name);
        }
    }

    getClient(name: BotName): BotClient | undefined {
        return this.clients.get(name);
    }

    getBotStatus(name: BotName): BotStatus | null {
        const client = this.clients.get(name);
        if (!client) return null;

        const startTime = this.startTimes.get(name);

        return {
            name,
            online: client.isReady(),
            uptime: startTime ? Date.now() - startTime : null,
            guilds: client.guilds.cache.size,
            ping: client.ws.ping,
            modulesLoaded: [...client.loadedModules],
        };
    }

    getAllStatuses(): BotStatus[] {
        return BOT_DEFINITIONS.map((def) => {
            return this.getBotStatus(def.name) ?? {
                name: def.name,
                online: false,
                uptime: null,
                guilds: 0,
                ping: -1,
                modulesLoaded: [],
            };
        });
    }

    getActiveCount(): number {
        return this.clients.filter((c) => c.isReady()).size;
    }
}
