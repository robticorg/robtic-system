import { Events, type GuildMember, type PartialGuildMember } from "discord.js";
import { sendWelcome } from "../services/community/welcome";

/** The server's goodbye (dashboard → Welcome), if it turned it on. */
export default {
    name: Events.GuildMemberRemove,

    async execute(member: GuildMember | PartialGuildMember) {
        await sendWelcome(member, "leave");
    },
};
