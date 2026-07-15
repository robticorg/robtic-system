const EMOJI_REGEX = /<a?:\w+:\d+>|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}️‍]/gu;

export function isEmojiOnly(content: string): boolean {
    return content.replace(EMOJI_REGEX, "").trim().length === 0;
}

/** Minimum-length, non-emoji-only gate shared by message-driven engagement features (streaks, combos, etc). */
export function isAcceptableMessage(content: string, minLength: number): boolean {
    const trimmed = content.trim();
    if (trimmed.length < minLength) return false;
    if (isEmojiOnly(trimmed)) return false;
    return true;
}
