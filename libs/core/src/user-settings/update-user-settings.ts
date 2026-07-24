import type { UserSettings, UserSettingsUpdate } from "@typings/user-settings";
import { UserRepository } from "@database/repositories";
import { getUserSettings } from "./get-user-settings";

const DISPLAY_NAME_MAX_LENGTH = 32;

/**
 * Applies a partial settings update and returns the resulting snapshot. Values are re-validated
 * here (never trusted from a client): unknown languages are ignored, display names are trimmed
 * and capped at the same 32-char limit the bot's modal enforces.
 */
export async function updateUserSettings(
    discordId: string,
    username: string,
    update: UserSettingsUpdate,
): Promise<UserSettings> {
    if (update.lang === "en" || update.lang === "ar") {
        await UserRepository.setPreferredLang(discordId, username, update.lang);
    }

    if (typeof update.displayName === "string") {
        const displayName = update.displayName.trim().slice(0, DISPLAY_NAME_MAX_LENGTH);
        if (displayName) {
            await UserRepository.setDisplayName(discordId, username, displayName);
        }
    }

    if (typeof update.privateProfile === "boolean") {
        await UserRepository.setPrivateProfile(discordId, username, update.privateProfile);
    }

    return getUserSettings(discordId);
}
