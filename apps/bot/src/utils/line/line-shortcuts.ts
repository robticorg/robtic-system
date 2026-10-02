/** Most shortcut words a server can set, and the longest one. */
export const LINE_SHORTCUT_LIMITS = { maxWords: 20, maxLength: 32 } as const;

/**
 * `"خط, Line ,line,  "` → `["خط", "line"]`: split on commas, trimmed, lowercased, deduplicated,
 * empty and over-long entries dropped, at most `maxWords`. Pure, so the rules are testable.
 */
export function parseLineShortcuts(input: string): string[] {
    const words = input
        .split(",")
        .map(w => w.trim().toLowerCase())
        .filter(w => w.length > 0 && w.length <= LINE_SHORTCUT_LIMITS.maxLength);
    return [...new Set(words)].slice(0, LINE_SHORTCUT_LIMITS.maxWords);
}

/** Whether a whole message is one of the shortcut words (case-insensitive, surrounding spaces ignored). */
export function matchesLineShortcut(content: string, shortcuts: readonly string[]): boolean {
    if (!shortcuts.length) return false;
    const text = content.trim().toLowerCase();
    return text.length > 0 && shortcuts.includes(text);
}
