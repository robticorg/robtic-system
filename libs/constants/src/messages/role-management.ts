import { bilingual } from "@utils/lang-context";

/** Replies from `/ban`, `/unban`, `/kick`, `/role` and `/roles`. */
export const MODERATION_ACTION_MESSAGES = bilingual({
    guildOnly: "This command can only be used in a server.",
    banSelf: "You can't ban yourself.",
    banBot: "You can't ban me.",
    notInGuild: "That member isn't in this server.",
    invalidUserId: (value: string) => `\`${value}\` is not a valid user id or mention.`,

    banMissingPermission: "I'm missing the **Ban Members** permission.",
    banNotBannable: "I can't ban that member: their highest role is above mine.",
    banAboveExecutor: "You can't ban someone whose highest role is at or above your own.",
    banned: (userTag: string, userId: string, reason: string) => `🔨 Banned **${userTag}** (\`${userId}\`): ${reason}`,
    banFailed: "The ban failed. Check my role position and permissions.",
    alreadyBanned: (userId: string) => `\`${userId}\` is already banned.`,

    unbanNotBanned: (userId: string) => `\`${userId}\` is not on this server's ban list.`,
    unbanned: (userTag: string, userId: string, reason: string) => `✅ Unbanned **${userTag}** (\`${userId}\`): ${reason}`,
    unbanFailed: "The unban failed. Check my **Ban Members** permission.",

    kickMissingPermission: "I'm missing the **Kick Members** permission.",

    rolesMissingPermission: "I'm missing the **Manage Roles** permission.",
    roleUnmanageable: (roleName: string) => `**${roleName}** is above my highest role, so I can't assign it.`,
    roleManagedByIntegration: (roleName: string) => `**${roleName}** is managed by an integration or is the server booster role, so it can't be assigned manually.`,
    roleAboveExecutor: (roleName: string) => `**${roleName}** is at or above your highest role, so you can't hand it out.`,
    roleEveryone: "The @everyone role can't be given or removed.",
    roleAlreadyHas: (userTag: string, roleName: string) => `**${userTag}** already has **${roleName}**.`,
    roleDoesNotHave: (userTag: string, roleName: string) => `**${userTag}** doesn't have **${roleName}**.`,
    roleGiven: (userTag: string, roleName: string) => `✅ Gave **${roleName}** to **${userTag}**.`,
    roleRemoved: (userTag: string, roleName: string) => `✅ Removed **${roleName}** from **${userTag}**.`,
    roleFailed: "Discord rejected the role change. Check my role position and permissions.",

    multiroleNone: "None of those roles could be given. See the reasons above.",
    multiroleResult: (userTag: string, applied: string[], skipped: string[]) => {
        const lines = [`✅ Gave **${applied.length}** role(s) to **${userTag}**: ${applied.join(", ")}`];
        if (skipped.length) lines.push(`⚠️ Skipped: ${skipped.join(" • ")}`);
        return lines.join("\n");
    },

    rolesListEmpty: "This server has no roles besides @everyone.",
}, {
    guildOnly: "هذا الأمر يعمل داخل السيرفر فقط.",
    banSelf: "ما تقدر تبند نفسك.",
    banBot: "ما تقدر تبندني.",
    notInGuild: "هذا العضو غير موجود في السيرفر.",
    invalidUserId: (value: string) => `\`${value}\` ليس آيدي أو منشن صحيح.`,

    banMissingPermission: "ينقصني صلاحية **Ban Members**.",
    banNotBannable: "ما أقدر أبند هذا العضو: أعلى رتبة عنده فوق رتبتي.",
    banAboveExecutor: "ما تقدر تبند شخص رتبته أعلى من رتبتك أو تساويها.",
    banned: (userTag: string, userId: string, reason: string) => `🔨 تم تبنيد **${userTag}** (\`${userId}\`): ${reason}`,
    banFailed: "فشل التبنيد. تأكد من ترتيب رتبتي وصلاحياتي.",
    alreadyBanned: (userId: string) => `\`${userId}\` مبند من قبل.`,

    unbanNotBanned: (userId: string) => `\`${userId}\` غير موجود في قائمة المبندين.`,
    unbanned: (userTag: string, userId: string, reason: string) => `✅ تم فك الباند عن **${userTag}** (\`${userId}\`): ${reason}`,
    unbanFailed: "فشل فك الباند. تأكد من صلاحية **Ban Members**.",

    kickMissingPermission: "ينقصني صلاحية **Kick Members**.",

    rolesMissingPermission: "ينقصني صلاحية **Manage Roles**.",
    roleUnmanageable: (roleName: string) => `**${roleName}** أعلى من رتبتي، ما أقدر أعطيها.`,
    roleManagedByIntegration: (roleName: string) => `**${roleName}** تابعة لتطبيق أو رتبة البوستر، ما تنعطى يدوياً.`,
    roleAboveExecutor: (roleName: string) => `**${roleName}** أعلى من رتبتك أو تساويها، ما تقدر تعطيها.`,
    roleEveryone: "رتبة @everyone ما تنعطى ولا تنشال.",
    roleAlreadyHas: (userTag: string, roleName: string) => `**${userTag}** عنده **${roleName}** من قبل.`,
    roleDoesNotHave: (userTag: string, roleName: string) => `**${userTag}** ما عنده **${roleName}**.`,
    roleGiven: (userTag: string, roleName: string) => `✅ تم إعطاء **${roleName}** لـ **${userTag}**.`,
    roleRemoved: (userTag: string, roleName: string) => `✅ تم سحب **${roleName}** من **${userTag}**.`,
    roleFailed: "رفض ديسكورد تغيير الرتبة. تأكد من ترتيب رتبتي وصلاحياتي.",

    multiroleNone: "ما قدرت أعطي أي رتبة منها. شوف الأسباب فوق.",
    multiroleResult: (userTag: string, applied: string[], skipped: string[]) => {
        const lines = [`✅ تم إعطاء **${applied.length}** رتبة لـ **${userTag}**: ${applied.join("، ")}`];
        if (skipped.length) lines.push(`⚠️ تم تخطي: ${skipped.join(" • ")}`);
        return lines.join("\n");
    },

    rolesListEmpty: "ما في رتب في السيرفر غير @everyone.",
});
