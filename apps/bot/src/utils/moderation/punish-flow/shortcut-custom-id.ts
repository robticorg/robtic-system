import type { PunishCustomIdParts } from "@typings/punishment";
import { parseLegacyPunishId } from "./proof-custom-id";

/** The "Submit proof" button in a moderator's DMs: `punish_shortcut:<request id>`. */
export const shortcutButtonCustomId = (requestId: string): string => `punish_shortcut:${requestId}`;

/** The request id, or the old all-in-one format (still read for buttons sent before the change). */
export function parseShortcutButtonCustomId(customId: string): { requestId: string } | PunishCustomIdParts | null {
    const saved = /^punish_shortcut:([a-f0-9]{24})$/.exec(customId);
    if (saved) return { requestId: saved[1]! };
    return parseLegacyPunishId(customId);
}
