export type UserLang = "en" | "ar";

export interface UserSettings {
    lang: UserLang;
    displayName: string | null;
    privateProfile: boolean;
}

export interface UserSettingsUpdate {
    lang?: UserLang;
    displayName?: string;
    privateProfile?: boolean;
}
