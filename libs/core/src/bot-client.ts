import {
    Client,
    Collection,
    REST,
    type ClientEvents,
    type GatewayIntentBits,
    type Partials,
} from "discord.js";
import type { EventEmitter } from "node:events";
import type { CommandConfig, ComponentHandler } from "@typings/command";
import type { MessageCommandConfig } from "@typings/message-command";
import { Logger } from "@logger";
import { sendStatus } from "./status/status";
import { publishCommands } from "./registration/publish-commands";

/** Comfortably above the listeners the loader attaches, low enough that a real leak still warns. */
const MAX_LISTENERS_PER_EVENT = 40;

export class BotClient extends Client {
    public commands = new Collection<string, CommandConfig>();
    public components = new Collection<string, ComponentHandler>();
    /** Prefix-only handlers, keyed by name and by each alias. Deliberately separate from `commands`. */
    public messageCommands = new Collection<string, MessageCommandConfig>();
    /**
     * Every listener the loader attached, so a reload can detach exactly those and no others.
     *
     * Typed against the base EventEmitter rather than discord.js's per-event overloads: those
     * resolve one concrete event name at a time and cannot accept a `keyof ClientEvents` union.
     */
    public eventBindings: Array<{ name: keyof ClientEvents; listener: (...args: unknown[]) => void }> = [];

    /** The client as a plain emitter, for attaching/detaching listeners by a non-literal event name. */
    asEmitter(): EventEmitter {
        return this as unknown as EventEmitter;
    }
    public botName: BotName;
    private token_: string;

    constructor(name: BotName, token: string, intents: GatewayIntentBits[], partials?: Partials[]) {
        super({ intents, ...(partials?.length ? { partials } : {}) });
        this.botName = name;
        this.token_ = token;

        this.setMaxListeners(MAX_LISTENERS_PER_EVENT);
    }

    async start(): Promise<void> {
        try {
            await sendStatus(this.botName, "STARTING", "Booting...");
            await this.login(this.token_);
            Logger.success(`Bot started`, this.botName);
            await sendStatus(this.botName, "HEALTHY", `${this.user?.tag} online`)
        } catch (err) {
            Logger.error(`Failed to start: ${err}`, this.botName);
            await sendStatus(this.botName, "OFFLINE", "Startup failed")
            throw err;
        }
    }
    /** A REST client bound to this bot's token, for callers that publish command routes directly. */
    rest_(): REST {
        return new REST({ version: "10" }).setToken(this.token_);
    }

    /** Publishes the loaded commands to Discord — see publishCommands. False when any route failed. */
    async registerSlashCommands(): Promise<boolean> {
        if (!this.user) {
            Logger.warn("Client not ready, deferring command registration", this.botName);
            return false;
        }

        return publishCommands(this.rest_(), this.user.id, this.commands, this.botName);
    }
}
