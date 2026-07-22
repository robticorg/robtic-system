import { isEmojiOnly } from "./is-emoji-only";

/** Minimum-length, non-emoji-only gate shared by message-driven engagement features (streaks, combos, etc). */
export function isAcceptableMessage(content: string, minLength: number): boolean {
    const trimmed = content.trim();
    if (trimmed.length < minLength) return false;
    if (isEmojiOnly(trimmed)) return false;
    return true;
}
