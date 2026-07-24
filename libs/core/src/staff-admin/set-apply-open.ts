import { SubmissionTypeRepository } from "@database/repositories";

/** Opens or closes one application type. Returns false when the key doesn't exist. */
export async function setApplyOpen(guildId: string, key: string, isOpen: boolean): Promise<boolean> {
    const updated = await SubmissionTypeRepository.setOpen(guildId, key, isOpen);
    return updated !== null;
}
