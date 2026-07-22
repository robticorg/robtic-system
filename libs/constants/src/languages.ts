import { BRANCH_CONFIG } from "@config";

/** Languages members can pick via role; keys are the language codes stored per user. */
export const SUPPORTED_LANGUAGES = {
    en: {
        id: BRANCH_CONFIG.roles.lang.en,
        name: "English",
    },
    ar: {
        id: BRANCH_CONFIG.roles.lang.ar,
        name: "Arabic",
    },
} as const;
