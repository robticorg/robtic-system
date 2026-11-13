import { bilingual } from "@utils/lang-context";

/** Replies from `<prefix>guild <id> add|remove`, which manages the guild whitelist the guard enforces. */
export const SERVER_WHITELIST_MESSAGES = bilingual({
    usage: (prefix: string) => `Usage: \`${prefix}guild <server id> add\` or \`${prefix}guild <server id> remove\``,
    invalidId: (value: string) => `\`${value}\` is not a valid server id. Paste the 17–20 digit id from "Copy Server ID".`,
    added: (guildId: string, name?: string) =>
        `✅ Added **${name ?? guildId}** (\`${guildId}\`) to the allowed servers. The bot can now be invited there and will stay.`,
    alreadyAdded: (guildId: string) => `\`${guildId}\` is already allowed.`,
    removed: (guildId: string) =>
        `✅ Removed \`${guildId}\` from the allowed servers. The bot leaves it the next time it starts or is invited back.`,
    notListed: (guildId: string) => `\`${guildId}\` is not on the allowed servers list.`,
    cannotRemoveCurrent: "This is the server you're running the command in. Remove it from another server, or the bot would leave mid-command.",
}, {
    usage: (prefix: string) => `الاستخدام: \`${prefix}guild <آيدي السيرفر> add\` أو \`${prefix}guild <آيدي السيرفر> remove\``,
    invalidId: (value: string) => `\`${value}\` ليس آيدي سيرفر صحيح. انسخ الآيدي من "Copy Server ID".`,
    added: (guildId: string, name?: string) =>
        `✅ تمت إضافة **${name ?? guildId}** (\`${guildId}\`) للسيرفرات المسموحة. البوت يقدر يدخله ويبقى فيه.`,
    alreadyAdded: (guildId: string) => `\`${guildId}\` مسموح من قبل.`,
    removed: (guildId: string) =>
        `✅ تم حذف \`${guildId}\` من السيرفرات المسموحة. البوت بيطلع منه عند التشغيل القادم أو إذا انضاف مرة ثانية.`,
    notListed: (guildId: string) => `\`${guildId}\` غير موجود في قائمة السيرفرات المسموحة.`,
    cannotRemoveCurrent: "هذا نفس السيرفر اللي تستخدم فيه الأمر. احذفه من سيرفر ثاني، وإلا البوت بيطلع أثناء الأمر.",
});
