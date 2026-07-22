import { FIRST_CHAR_ALNUM_REGEX } from "@constants";

/** Attachment/embed-only messages (e.g. screenshots) count as commands so callers leave them alone. */
export function looksLikeCommand(content: string): boolean {
    const trimmed = content.trim();
    if (!trimmed) return true;
    return !FIRST_CHAR_ALNUM_REGEX.test(trimmed);
}
