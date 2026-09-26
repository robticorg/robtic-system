import { AllowedGuildRepository } from "@database/repositories";

export async function isAllowedGuild(guildId: string): Promise<boolean> {
    return AllowedGuildRepository.isAllowed(guildId);
}
