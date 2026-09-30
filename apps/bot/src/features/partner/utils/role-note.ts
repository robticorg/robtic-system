import type { PartnerRoleResult } from "./partner-role";

/** What to tell the staff member about the representative's partner role after an add or edit. */
export const ROLE_NOTE: Record<PartnerRoleResult, (userId: string) => string> = {
    granted: id => `<@${id}> got the partner role.`,
    removed: () => "",
    kept: () => "",
    "not-member": id => `<@${id}> isn't in the server yet — they'll get the partner role when they join.`,
    "no-role": () => "No partner role is set, so no role was given. Set one with `/partner role`.",
    failed: id => `⚠️ I couldn't give <@${id}> the partner role — check that it's below my highest role.`,
};
