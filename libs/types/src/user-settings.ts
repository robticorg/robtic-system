export type UserLang = "en" | "ar";

/** Per-user preferences shared by the bot commands and the Activity settings page. */
export interface UserSettings {
    /** Language used for every localized bot reply and the Activity UI. */
    lang: UserLang;
    /** How the bot refers to the user; null falls back to their Discord username. */
    displayName: string | null;
    /** Hides profile stats from other members when true. */
    privateProfile: boolean;
}

/** Partial update sent from a settings surface — every field is optional and re-validated server-side. */
export interface UserSettingsUpdate {
    lang?: UserLang;
    displayName?: string | null;
    privateProfile?: boolean;
}
