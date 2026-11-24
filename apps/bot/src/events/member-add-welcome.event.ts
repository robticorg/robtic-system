import { Events, type GuildMember } from "discord.js";
import { ServerConfigRepository } from "@database/repositories";
import { BRANCH_CONFIG } from "@config";
import { hasOwnWelcome, sendWelcome } from "../services/community/welcome";

export default {
    name: Events.GuildMemberAdd,

    async execute(member: GuildMember) {
        if (member.user.bot) return;

        // The server's own welcome (dashboard → Welcome), if it turned one on.
        void sendWelcome(member, "join");

        const config = await ServerConfigRepository.find(member.guild.id);
        const membersRoleId = config?.roles?.members;
        const role = membersRoleId ? member.guild.roles.cache.get(membersRoleId) : null;

        // Robtic's own greeting in its own channels, unless the server set up its own welcome.
        const channels = BRANCH_CONFIG.channels.generalChat;
        if (process.env.NODE_ENV === "production" && channels.some(id => member.guild.channels.cache.has(id)) && !(await hasOwnWelcome(member.guild.id))) {
            channels.forEach(async id => {
                const channel = member.guild.channels.cache.get(id);
                if (channel?.isTextBased()) {
                    await channel.send(`🎉 Welcome <@${member.id}> to the ${BRANCH_CONFIG.server.fullName}!`);
                }
            });
        }

        if (role) {
            await member.roles.add(role);
        } else {
            console.log("Members role not configured — use /set-role type:members");
        }
    }
};
