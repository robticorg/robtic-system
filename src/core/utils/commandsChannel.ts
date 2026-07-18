/** First non-whitespace char being a symbol/punctuation covers any bot's command prefix generically, without hardcoding a prefix list. */
const FIRST_CHAR_ALNUM = /^[\p{L}\p{N}]/u;

export function looksLikeCommand(content: string): boolean {
    const trimmed = content.trim();
    if (!trimmed) return true; // attachment/embed-only messages (e.g. screenshots) are left alone
    return !FIRST_CHAR_ALNUM.test(trimmed);
}
