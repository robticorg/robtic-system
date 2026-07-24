import type { UserSettings } from "@typings/user-settings";
import { UserRepository } from "@database/repositories";

/** Reads the user's bot-wide preferences (language, display name, privacy). */
export async function getUserSettings(discordId: string): Promise<UserSettings> {
    const [lang, displayName, privateProfile] = await Promise.all([
        UserRepository.getPreferredLang(discordId),
        UserRepository.getDisplayName(discordId),
        UserRepository.getPrivateProfile(discordId),
    ]);

    return {
        lang: lang ?? "en",
        displayName,
        privateProfile,
    };
}
