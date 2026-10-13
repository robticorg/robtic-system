import { Events } from "discord.js";
import type { EventConfig } from "@typings/event";
import { handleError, BotError } from "@core/handlers";
import { syncAllTagRoles, syncMemberTagRole, syncUserTagRoles } from "./functions/tag-roles";

const CTX = "main/tag";

export default [
    /** On start: put every server's tag role back in step with who wears a tag now. */
    {
        name: Events.ClientReady,
        once: true,
        execute: client => {
            void syncAllTagRoles(client).catch(err => handleError(new BotError(`Failed to sync tag roles: ${err}`, "EVENT"), CTX));
        },
    } satisfies EventConfig<Events.ClientReady>,

    /** A user put a tag on, switched it or took it off — avatar and name changes are ignored. */
    {
        name: Events.UserUpdate,
        execute: async (oldUser, newUser, client) => {
            const before = oldUser.primaryGuild, after = newUser.primaryGuild;
            const unchanged = !oldUser.partial
                && before?.identityGuildId === after?.identityGuildId
                && before?.identityEnabled === after?.identityEnabled;
            if (unchanged) return;
            try {
                await syncUserTagRoles(client, newUser);
            } catch (err) {
                handleError(new BotError(`Failed to update tag roles for ${newUser.id}: ${err}`, "EVENT"), CTX);
            }
        },
    } satisfies EventConfig<Events.UserUpdate>,

    /** Someone already wearing a tag joined a server. */
    {
        name: Events.GuildMemberAdd,
        execute: async member => {
            try {
                await syncMemberTagRole(member);
            } catch (err) {
                handleError(new BotError(`Failed to set the tag role for joining member ${member.id}: ${err}`, "EVENT"), CTX);
            }
        },
    } satisfies EventConfig<Events.GuildMemberAdd>,
];
