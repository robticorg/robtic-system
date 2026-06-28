import { existsSync } from "fs";
import { BotClient } from "@core/BotClient";

import { Logger } from "@core/libs";
import { handleError, BotError } from "@core/handlers";
import type { CommandConfig, ComponentHandler } from "@core/config";

const tsGlob = new Bun.Glob("**/*.ts");

export class ModuleLoader {
    constructor(private client: BotClient) {}

    async loadCommands(dir: string): Promise<void> {
        if (!existsSync(dir)) return;
        for await (const file of tsGlob.scan({ cwd: dir, absolute: true })) {
            if (file.endsWith(".d.ts")) continue;
            try {
                const mod = await import(file);
                const command: CommandConfig = mod.default;
                if (command?.data && command?.run!) {
                    this.client.commands.set(command.data.name, command);
                    Logger.debug(`Loaded command/context-menu: ${command.data.name}`, this.client.botName);
                } else {
                    Logger.warn(`Invalid command at ${file}`, this.client.botName);
                }
            } catch (err) {
                handleError(
                    new BotError(`Failed to load: ${file}`, "MODULE"),
                    file
                );
            }
        }
    }

    async loadEvents(dir: string): Promise<void> {
        if (!existsSync(dir)) return;
        for await (const file of tsGlob.scan({ cwd: dir, absolute: true })) {
            if (file.endsWith(".d.ts")) continue;
            try {
                const mod = await import(file);
                const event = mod.default;
                if (event?.name && event?.execute) {
                    if (event.once) {
                        this.client.once(event.name, (...args: unknown[]) =>
                            event.execute(...args, this.client)
                        );
                    } else {
                        this.client.on(event.name, (...args: unknown[]) =>
                            event.execute(...args, this.client)
                        );
                    }
                    Logger.debug(`Loaded event: ${event.name}`, this.client.botName);
                } else {
                    Logger.warn(`Invalid event at ${file}`, this.client.botName);
                }
            } catch (err) {
                handleError(
                    new BotError(`Failed to load: ${file}`, "MODULE"),
                    file
                );
            }
        }
    }

    async loadComponents(dir: string): Promise<void> {
        if (!existsSync(dir)) return;
        for await (const file of tsGlob.scan({ cwd: dir, absolute: true })) {
            if (file.endsWith(".d.ts")) continue;
            try {
                const mod = await import(file);
                for (const exp of Object.values(mod)) {
                    const component = exp as ComponentHandler;
                    if (component?.customId && typeof component?.run === "function") {
                        const key = component.customId instanceof RegExp
                            ? component.customId.source
                            : component.customId;
                        this.client.components.set(key, component);
                        Logger.debug(`Loaded component: ${key}`, this.client.botName);
                    }
                }
            } catch (err) {
                handleError(
                    new BotError(`Failed to load: ${file}`, "MODULE"),
                    file
                );
            }
        }
    }
}
