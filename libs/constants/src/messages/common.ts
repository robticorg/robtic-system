import { bilingual } from "@utils/lang-context";

/** Static user-facing text shared across every bot module. */
export const SHARED_MESSAGES = {
    /** Leads every plain-text refusal, so a failure still reads as one at a glance. */
    errorPrefix: "❌",
} as const;

/** Replies produced by the shared interaction pipeline (permission/cooldown/component checks). */
export const INTERACTION_MESSAGES = bilingual({
    staleComponent: "This action is no longer available. Please try again.",
    guildOnlyCommand: "This command can only be used in a server.",
    noPermission: "You don't have permission to use this command.",
    superUserOnly: "This is a bot-owner command. Only super users can run it.",
    serverAdminOnly: "Only server administrators, or a bot admin role set on the dashboard, can use this command.",
    profileTabDisabled: "That section isn't enabled in this server.",
    featureDisabled: (description: string, key: string) =>
        `${description} is not enabled in this server. An administrator can turn it on from the dashboard (\`${key}\`).`,
    cooldownWait: (remainingSeconds: number) => `Please wait ${remainingSeconds}s before using this command again.`,
}, {
    staleComponent: "هذا الإجراء لم يعد متاحاً. حاول مرة ثانية.",
    guildOnlyCommand: "هذا الأمر يعمل داخل السيرفر فقط.",
    noPermission: "ليس لديك صلاحية استخدام هذا الأمر.",
    superUserOnly: "هذا أمر خاص بمالك البوت فقط.",
    serverAdminOnly: "هذا الأمر لإدارة السيرفر فقط، أو لرتبة مشرفي البوت المحددة في لوحة التحكم.",
    profileTabDisabled: "هذا القسم غير مفعّل في هذا السيرفر.",
    featureDisabled: (description: string, key: string) =>
        `${description} غير مفعّل في هذا السيرفر. يقدر المسؤول يفعّله من لوحة التحكم (\`${key}\`).`,
    cooldownWait: (remainingSeconds: number) => `انتظر ${remainingSeconds} ثانية قبل استخدام الأمر مرة ثانية.`,
});
