import { Events, type GuildMember } from "discord.js";
import { ServerConfigRepository } from "@database/repositories";
import data from "@shared/data.json";

export default {
    name: Events.GuildMemberAdd,

    async execute(member: GuildMember) {
        if (member.user.bot) return;

        const config = await ServerConfigRepository.find(member.guild.id);
        const membersRoleId = config?.roles?.members;
        const role = membersRoleId ? member.guild.roles.cache.get(membersRoleId) : null;

        const channels = data.general_chat_channel_id;
        channels.forEach(async id => {
            const channel = member.guild.channels.cache.get(id);
            if (channel?.isTextBased() && process.env.NODE_ENV === "production") {
                await channel.send(`🎉 Welcome <@${member.id}> to the Robtic Server!`);
            }
        });

        if (role) {
            await member.roles.add(role);
        } else {
            console.log("Members role not configured — use /set-role type:members");
        }
    }
};
