import { EMOJI_REGEX } from "@constants";

export function isEmojiOnly(content: string): boolean {
    return content.replace(EMOJI_REGEX, "").trim().length === 0;
}
