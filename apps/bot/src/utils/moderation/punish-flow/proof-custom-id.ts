import type { PunishType, PunishCustomIdParts } from "@typings/punishment";
import { PUNISH_CUSTOM_ID_SEGMENTS, PUNISH_EXTRA_NONE } from "@constants";

/** The proof form for a saved request (punish-request.ts): `punish_proof:<request id>`. */
export const proofModalCustomId = (requestId: string): string => `punish_proof:${requestId}`;

/**
 * A proof form's id: the request id, or the old format that carried everything (`punish_proof_<type>_<guild>_…`),
 * still read so forms opened before the change can be submitted.
 */
export function parseProofCustomId(customId: string): { requestId: string } | PunishCustomIdParts | null {
    const saved = /^punish_proof:([a-f0-9]{24})$/.exec(customId);
    if (saved) return { requestId: saved[1]! };
    return parseLegacyPunishId(customId);
}

/** The old all-in-one id: `punish_<proof|shortcut>_<type>_<guild>_<target>_<reason>_<moderator>_<extra>`. */
export function parseLegacyPunishId(customId: string): PunishCustomIdParts | null {
    const parts = customId.split("_");
    if (parts.length < PUNISH_CUSTOM_ID_SEGMENTS) return null;
    const [, , type, guildId, targetId, reasonKey, moderatorId, extra] = parts;
    if (!type || !guildId || !targetId || !reasonKey || !moderatorId) return null;
    return { type: type as PunishType, guildId, targetId, reasonKey, moderatorId, extra: extra ?? PUNISH_EXTRA_NONE };
}
