import { Collection, GatewayIntentBits, Partials } from "discord.js";

import { BotClient } from "@core/BotClient";
import { ModuleLoader } from "@core/ModuleLoader";
import { DiscordErrorHandler } from "@core/handlers";
import { Logger } from "@core/libs";
import { BOT_DEFINITIONS } from "@core/config";

export class ClientManager {
    private clients = new Collection<BotName, BotClient>();
    private startTimes = new Collection<BotName, number>();
    private tokenToClient = new Map<string, BotClient>();
    private botModulesRoot = `${import.meta.dir}/../../../apps/bot/src`;
    private static instance: ClientManager;

    private constructor() {}

    static getInstance(): ClientManager {
        if (!ClientManager.instance) {
            ClientManager.instance = new ClientManager();
        }
        return ClientManager.instance;
    }

    /** Directory containing the per-bot module folders (commands/events/components); set by the app entrypoint. */
    setBotModulesRoot(dir: string): void {
        this.botModulesRoot = dir;
    }

    private resolveToken(name: BotName): string | undefined {
        const definition = BOT_DEFINITIONS.find((d) => d.name === name);
        return definition ? process.env[definition.tokenKey] : undefined;
    }

    private unionIntentsForToken(token: string): { intents: GatewayIntentBits[]; partials: Partials[] } {
        const matching = BOT_DEFINITIONS.filter((d) => process.env[d.tokenKey] === token);
        const intents = [...new Set(matching.flatMap((d) => d.intents))];
        const partials = [...new Set(matching.flatMap((d) => d.partials ?? []))];
        return { intents, partials };
    }

    async initializeBot(definition: BotDefinition<GatewayIntentBits, Partials>): Promise<BotClient> {
        const token = process.env[definition.tokenKey];
        if(!token) return Promise.reject(new Error(`Token for bot "${definition.name}" not found in environment variables`));

        let client = this.tokenToClient.get(token);

        if (!client) {
            const { intents, partials } = this.unionIntentsForToken(token);
            client = new BotClient(definition.name, token, intents, partials.length ? partials : undefined);

            const errorHandler = new DiscordErrorHandler(client);
            errorHandler.init();

            const sharedDir = `${this.botModulesRoot}/shared`;
            await new ModuleLoader(client).loadEvents(sharedDir);

            this.tokenToClient.set(token, client);
        } else {
            Logger.info(`Bot "${definition.name}" shares a token with an already-running bot — merging into one client instead of logging in again`, "ClientManager");
        }

        const loader = new ModuleLoader(client);
        const botDir = `${this.botModulesRoot}/${definition.name}`;
        const alreadyLoaded = client.loadedModules.includes(definition.name);

        await loader.loadCommands(`${botDir}/commands`);
        if (!alreadyLoaded) {
            // Re-attaching event listeners on an already-merged, still-live client would duplicate them.
            await loader.loadEvents(`${botDir}/events`);
        }
        await loader.loadComponents(`${botDir}/components`);

        if (!alreadyLoaded) {
            client.loadedModules.push(definition.name);
        }

        this.clients.set(definition.name, client);
        return client;
    }

    async startBot(name: BotName): Promise<void> {
        const client = this.clients.get(name);
        if (!client) {
            Logger.error(`Bot "${name}" not initialized`, "ClientManager");
            return;
        }

        if (client.isReady()) {
            // Another bot definition sharing this token already logged this client in.
            this.startTimes.set(name, this.startTimes.get(name) ?? Date.now());
            await client.registerSlashCommands();
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

        const sharedWithOthers = this.clients.some((c, n) => n !== name && c === client);

        this.clients.delete(name);
        this.startTimes.delete(name);

        if (sharedWithOthers) {
            Logger.info(`Bot "${name}" detached (its token is shared with another running bot, connection kept alive)`, "ClientManager");
            return;
        }

        const token = this.resolveToken(name);
        if (token) this.tokenToClient.delete(token);

        client.destroy();
        Logger.info(`Bot "${name}" stopped`, "ClientManager");
    }

    async startAll(): Promise<void> {
        Logger.info("Initializing all bots...", "ClientManager");

        const tokenGroups = new Map<string, BotDefinition<GatewayIntentBits, Partials>[]>();
        for (const definition of BOT_DEFINITIONS) {
            const token = process.env[definition.tokenKey];
            if (!token) {
                Logger.error(`Token for bot "${definition.name}" not found in environment variables`, "ClientManager");
                continue;
            }
            const group = tokenGroups.get(token);
            if (group) group.push(definition);
            else tokenGroups.set(token, [definition]);
        }

        for (const group of tokenGroups.values()) {
            if (group.length > 1) {
                const names = group.map((d) => d.name).join(", ");
                Logger.info(`Bots [${names}] share one token — starting as a single merged bot`, "ClientManager");
            }

            try {
                for (const definition of group) {
                    await this.initializeBot(definition);
                }

                await this.startBot(group[0].name);
                for (const definition of group) {
                    this.startTimes.set(definition.name, this.startTimes.get(definition.name) ?? this.startTimes.get(group[0].name) ?? Date.now());
                }
            } catch (err) {
                const names = group.map((d) => d.name).join(", ");
                Logger.error(`Failed to start bot(s) "${names}": ${err}`, "ClientManager");
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

    /** Every live BotClient, deduped (two bot definitions sharing a token merge into one client instance). */
    getAllClients(): BotClient[] {
        return [...new Set(this.clients.values())];
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
