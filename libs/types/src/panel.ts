import type { ContainerBuilder } from "discord.js";
import type { Lang } from "./lang";

/**
 * Drop a file in `main/utils/panels/definitions` to add a panel — same idea as adding a command.
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
     * with `getContent()`'s Components V2 container.
     * "container": posts `getContent()` directly as the message, no button.
     */
    mode?: "embed" | "container";
    /** Button label — only used in "embed" mode. Defaults to "View Details". */
    buttonLabel?: string;
    accentColor?: number;
    /** Optional per-role content variants, matched against the clicking member's roles. */
    roles?: { roleId: string; label: string }[];
    /**
     * Builds the Components V2 container to display. The second argument is context-dependent:
     * - "container" mode: the panel's display name, for the initial post.
     * - "embed" mode: the matched role's `label` from `roles` (or `null`), on button click.
     */
    getContent: (lang: Lang, context: string | null) => ContainerBuilder;
}
