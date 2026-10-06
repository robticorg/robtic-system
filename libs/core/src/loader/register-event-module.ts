import type { ClientEvents } from "discord.js";
import type { BotClient } from "@core/bot-client";
import type { EventConfig } from "@typings/event";
import type { LoadReport } from "./load-report";
import { shouldHandle } from "../event-guard";

function isEvent(value: unknown): value is EventConfig {
    const candidate = value as EventConfig | undefined;
    return Boolean(candidate?.name && typeof candidate?.execute === "function");
}

/**
 * Attaches a `*.event.ts` default export, one listener or an array of them.
 *
 * Every binding is recorded on the client so a reload can detach exactly what it attached. Without
 * that, `/system reload` either skipped events entirely (the old behaviour, so event edits silently
 * did nothing) or duplicated every listener. `removeAllListeners` is not an option — it would also
 * tear down the ones DiscordErrorHandler installs.
 */
export function registerEventModule(client: BotClient, exported: unknown, path: string, report: LoadReport): void {
    const entries = Array.isArray(exported) ? exported : [exported];

    for (const entry of entries) {
        if (!isEvent(entry)) {
            report.invalid.push({ path, reason: "default export is not an EventConfig (needs `name` and `execute`)" });
            continue;
        }

        const name = entry.name as keyof ClientEvents;
        const run = (args: unknown[]) => (entry.execute as (...a: unknown[]) => unknown)(...args, client);
        // Split-brain gate: if another Gateway already took this event, this one doesn't handle it.
        const listener = (...args: unknown[]) => {
            const verdict = shouldHandle(name, args);
            if (verdict === true) return run(args);
            return verdict.then(handle => (handle ? run(args) : undefined));
        };
        const emitter = client.asEmitter();

        if (entry.once) emitter.once(name, listener);
        else emitter.on(name, listener);

        client.eventBindings.push({ name, listener });
        report.events++;
    }
}
