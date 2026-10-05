import { Logger } from "@logger";

type Step = { name: string; run: () => Promise<unknown> | unknown };

const steps: Step[] = [];
let installed = false;
let shuttingDown = false;

/**
 * Graceful shutdown for any process (Gateway, internal API, worker). Steps run in the order they
 * were registered — register "stop taking work" first and "close Redis/Mongo" last. Each step is
 * given a deadline so one stuck close can't keep the container alive until Docker kills it.
 */
export function onShutdown(name: string, run: Step["run"]): void {
    steps.push({ name, run });
    if (installed) return;
    installed = true;

    const handle = (signal: string) => {
        if (shuttingDown) return;
        shuttingDown = true;
        Logger.info(`${signal} received — shutting down`, "shutdown");
        void (async () => {
            for (const step of steps) {
                try {
                    await Promise.race([
                        Promise.resolve(step.run()),
                        new Promise((_, reject) => setTimeout(() => reject(new Error("timed out")), 20_000)),
                    ]);
                } catch (err) {
                    Logger.warn(`Shutdown step "${step.name}" failed: ${(err as Error).message}`, "shutdown");
                }
            }
            process.exit(0);
        })();
    };

    process.on("SIGTERM", () => handle("SIGTERM"));
    process.on("SIGINT", () => handle("SIGINT"));
}

export function isShuttingDown(): boolean {
    return shuttingDown;
}
