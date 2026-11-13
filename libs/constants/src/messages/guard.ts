import { bilingual } from "@utils/lang-context";

/** Embed text for the guild guard (unauthorized-guild protection). */
export const GUARD_MESSAGES = bilingual({
    embedTitle: "🛡️ Server guard",
    leftUnauthorizedGuild: "Left a server that isn't allowed, on startup.",
    blockedUnauthorizedJoin: "Left a server that isn't allowed, right after joining.",
    fieldGuild: "Server",
    fieldGuildId: "Server ID",
    fieldMembers: "Members",
}, {
    embedTitle: "🛡️ حماية السيرفرات",
    leftUnauthorizedGuild: "خرجت من سيرفر غير مسموح عند التشغيل.",
    blockedUnauthorizedJoin: "خرجت من سيرفر غير مسموح بعد الدخول مباشرة.",
    fieldGuild: "السيرفر",
    fieldGuildId: "آيدي السيرفر",
    fieldMembers: "الأعضاء",
});
