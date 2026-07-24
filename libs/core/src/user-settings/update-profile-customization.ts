import { UserRepository } from "@database/repositories";
import { GENERIC_URL_REGEX, PROFILE_BIO_MAX_LENGTH, PROFILE_TEMPLATES } from "@constants";

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const BANNER_URL_MAX_LENGTH = 400;

export interface ProfileCustomizationUpdate {
    displayName?: string;
    /** "#rrggbb"; empty string clears back to the default theme. */
    profileColor?: string;
    /** "#rrggbb"; empty string clears back to the default text palette. */
    textColor?: string;
    /** Image URL; empty string removes the banner. */
    bannerUrl?: string;
    /** Empty string removes the bio. */
    bio?: string;
    /** One of PROFILE_TEMPLATES. */
    template?: string;
}

/**
 * Validates and stores a self-service profile customization. Every value is re-checked here —
 * bad colors/URLs/templates are silently dropped rather than stored.
 */
export async function updateProfileCustomization(
    discordId: string,
    username: string,
    update: ProfileCustomizationUpdate,
): Promise<void> {
    if (typeof update.displayName === "string") {
        const displayName = update.displayName.trim().slice(0, 32);
        if (displayName) await UserRepository.setDisplayName(discordId, username, displayName);
    }

    const customization: Partial<{ profileColor: string; textColor: string; bannerUrl: string; bio: string; profileTemplate: string }> = {};

    if (typeof update.profileColor === "string") {
        const color = update.profileColor.trim();
        if (color === "" || HEX_COLOR_PATTERN.test(color)) customization.profileColor = color.toLowerCase();
    }

    if (typeof update.textColor === "string") {
        const color = update.textColor.trim();
        if (color === "" || HEX_COLOR_PATTERN.test(color)) customization.textColor = color.toLowerCase();
    }

    if (typeof update.bannerUrl === "string") {
        const url = update.bannerUrl.trim();
        if (url === "" || (url.length <= BANNER_URL_MAX_LENGTH && GENERIC_URL_REGEX.test(url))) {
            customization.bannerUrl = url;
        }
    }

    if (typeof update.bio === "string") {
        customization.bio = update.bio.trim().slice(0, PROFILE_BIO_MAX_LENGTH);
    }

    if (typeof update.template === "string" && (PROFILE_TEMPLATES as readonly string[]).includes(update.template)) {
        customization.profileTemplate = update.template;
    }

    if (Object.keys(customization).length > 0) {
        await UserRepository.setCustomization(discordId, username, customization);
    }
}
