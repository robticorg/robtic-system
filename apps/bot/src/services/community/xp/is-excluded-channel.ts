import { XPSettingsRepository } from "@database/repositories/XPSettingsRepository";
import { Logger } from "@logger";

const CTX = "community:xp";

/** A channel where neither chat XP nor the real-message counter is read at all. */
export async function isExcludedChannel(guildId: string, channelId: string): Promise<boolean> {
    const settings = await XPSettingsRepository.get(guildId);
    if (!settings) return false;
    const result = settings.excludedChannels.includes(channelId);
    if (result) Logger.debug(`Channel ${channelId} is excluded from XP/messages`, CTX);
    return result;
}
