/**
 * The channel utilities (each its own command: /lock, /clear…) reachable from a shortcut, and one example per accepted argument shape.
 *
 * Kept beside the parser's grammar rather than written out in the help builder: these examples are
 * the documentation for arguments that are matched by shape, so a shape the parser gains or loses
 * has exactly one place to be reflected. `""` is the bare form.
 */
export const CHAT_UTIL_EXAMPLES = {
    clear: ["", "10", "X", "١٠", "#channel", "10 #channel"],
    lock: ["", "#channel"],
    unlock: ["", "#channel"],
    hide: ["", "#channel"],
    unhide: ["", "#channel"],
    slowmode: ["5s", "1m", "0", "5s #channel"],
} as const satisfies Record<string, readonly string[]>;

export type ChatUtilName = keyof typeof CHAT_UTIL_EXAMPLES;

/** What these commands were before each became its own command: `/chat <name>`, and `show` for unhide. */
export const LEGACY_CHAT_UTIL = { show: "unhide" } as const;
