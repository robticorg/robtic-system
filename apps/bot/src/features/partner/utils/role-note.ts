import type { PartnerRoleResult } from "./partner-role";

import { bilingual } from "@utils";
/** What to tell the staff member about the representative's partner role after an add or edit. */
export const ROLE_NOTE = bilingual<Record<PartnerRoleResult, (userId: string) => string>>({
    granted: id => `<@${id}> got the partner role.`,
    removed: () => "",
    kept: () => "",
    "not-member": id => `<@${id}> isn't in the server yet: they'll get the partner role when they join.`,
    "no-role": () => "No partner role is set, so no role was given. Set one with `/partner role`.",
    failed: id => `⚠️ I couldn't give <@${id}> the partner role. Check that it's below my highest role.`,
}, {
    granted: id => `<@${id}> أخذ رتبة الشراكة.`,
    removed: () => "",
    kept: () => "",
    "not-member": id => `<@${id}> مو موجود في السيرفر لين الحين: بياخذ رتبة الشراكة أول ما يدخل.`,
    "no-role": () => "ما في رتبة شراكة محددة، فما انعطت رتبة. حددها بـ `/partner role`.",
    failed: id => `⚠️ ما قدرت أعطي <@${id}> رتبة الشراكة. تأكد إنها تحت أعلى رتبة عندي.`,
});
