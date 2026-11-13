import type { PunishType } from "@typings/punishment";
import { PUNISH_EXTRA_NONE } from "@constants";
import { PunishRequestRepository } from "@database/repositories";

export interface PunishRequestInput {
    guildId: string;
    type: PunishType;
    targetId: string;
    reasonKey: string;
    moderatorId: string;
    extra?: string;
}

/** Saves a punishment that is waiting for the moderator's proof; its id goes into the proof form and the DM button. */
export function openProofRequest(input: PunishRequestInput): Promise<string> {
    return PunishRequestRepository.create({ ...input, extra: input.extra ?? PUNISH_EXTRA_NONE, status: "proof" });
}
