import { existsSync } from "fs";
import type { ContainerBuilder } from "discord.js";
import type { Lang } from "@shared/utils/lang";
import { Logger } from "@core/libs";

/**
 * Drop a file in `./definitions` to add a panel — same idea as adding a command.
 * The file's default export is auto-loaded on first use; nothing else to wire up.
 */
export interface PanelDefinition {
    /** Unique id used for `/panels send`, button custom ids, and DB records. */
    key: string;
    /** Display name shown in `/panels list` and autocomplete. Defaults to `key`. */
    name?: string;
    /** Shown in the classic embed (ignored when `mode` is "container"). */
    description?: string;
    /**
     * "embed" (default): posts a classic embed with a button; clicking it replies
     * with `getContent()`'s Components V2 container (see com.md for what that means).
     * "container": posts `getContent()` directly as the message, no button.
     */
    mode?: "embed" | "container";
    /** Button label — only used in "embed" mode. Defaults to "View Details". */
    buttonLabel?: string;
    accentColor?: number;
    /** Optional per-role content variants, matched against the clicking member's roles. */
    roles?: { roleId: string; label: string }[];
    /**
     * Builds the Components V2 container to display (see com.md for what "components"
     * means here). The second argument is context-dependent:
     * - "container" mode: the panel's display name, for the initial post.
     * - "embed" mode: the matched role's `label` from `roles` (or `null`), on button click.
     */
    getContent: (lang: Lang, context: string | null) => ContainerBuilder;
}

const panels = new Map<string, PanelDefinition>();
const definitionsGlob = new Bun.Glob("**/*.ts");

export function registerPanel(panel: PanelDefinition): void {
    if (!panel?.key || typeof panel.getContent !== "function") {
        Logger.warn(`Skipped invalid panel definition (missing key or getContent)`, "Panels");
        return;
    }

    if (panels.has(panel.key)) {
        Logger.warn(`Panel key "${panel.key}" is already registered — overwriting`, "Panels");
    }

    panels.set(panel.key, panel);
}

let loadPromise: Promise<void> | null = null;

/** Scans `./definitions` and registers every file's default export. Safe to call repeatedly. */
export function ensurePanelsLoaded(): Promise<void> {
    if (!loadPromise) loadPromise = loadDefinitions();
    return loadPromise;
}

async function loadDefinitions(): Promise<void> {
    const dir = `${import.meta.dir}/definitions`;
    if (!existsSync(dir)) return;

    for await (const file of definitionsGlob.scan({ cwd: dir, absolute: true })) {
        if (file.endsWith(".d.ts")) continue;
        try {
            const mod = await import(file);
            const panel: PanelDefinition | undefined = mod.default;
            if (!panel?.key || typeof panel.getContent !== "function") {
                Logger.warn(`Invalid panel definition at ${file} (needs a default export with "key" and "getContent")`, "Panels");
                continue;
            }
            registerPanel(panel);
        } catch (err) {
            Logger.error(`Failed to load panel definition ${file}: ${err}`, "Panels");
        }
    }
}

export async function getPanel(key: string): Promise<PanelDefinition | undefined> {
    await ensurePanelsLoaded();
    return panels.get(key);
}

export async function listPanels(): Promise<PanelDefinition[]> {
    await ensurePanelsLoaded();
    return [...panels.values()];
}

export async function getPanelKeys(): Promise<{ name: string; value: string }[]> {
    const all = await listPanels();
    return all.map(p => ({ name: p.name ?? p.key, value: p.key }));
}
