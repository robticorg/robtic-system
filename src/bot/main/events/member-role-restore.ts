import { Events, type GuildMember } from "discord.js";
import { SavedRolesRepository } from "@database/repositories";
import { Logger } from "@core/libs";

const RESTORE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export default {
    name: Events.GuildMemberAdd,

    async execute(member: GuildMember) {
        if (member.user.bot) return;

        const saved = await SavedRolesRepository.find(member.guild.id, member.id);
        if (!saved) return;

        await SavedRolesRepository.remove(member.guild.id, member.id);

        const withinWindow = Date.now() - saved.leftAt.getTime() <= RESTORE_WINDOW_MS;
        if (!withinWindow) return;

        const rolesToRestore = saved.roles.filter((id) => member.guild.roles.cache.has(id));

        // Add one role at a time (not as a single array call) so this doesn't race with the
        // other guildMemberAdd listeners (welcome/partner) that also grant roles concurrently —
        // a multi-role add() replaces the member's whole role list from a local cache snapshot,
        // which can silently drop a role added by another listener in the same tick.
        for (const roleId of rolesToRestore) {
            await member.roles.add(roleId).catch((err) => {
                Logger.warn(`Could not restore role ${roleId} for ${member.id} in ${member.guild.id}: ${err}`, "role-restore");
            });
        }
    },
};
