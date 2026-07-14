import { Events, type GuildMember } from "discord.js";
import { SavedRolesRepository } from "@database/repositories";
import { Logger } from "@core/libs";

export default {
    name: Events.GuildMemberRemove,

    async execute(member: GuildMember) {
        if (member.user.bot) return;

        const roles = member.roles.cache
            .filter((role) => role.id !== member.guild.id && !role.managed)
            .map((role) => role.id);

        if (roles.length === 0) return;

        await SavedRolesRepository.save(member.guild.id, member.id, roles).catch((err) => {
            Logger.warn(`Could not save roles for ${member.id} leaving ${member.guild.id}: ${err}`, "role-restore");
        });
    },
};
