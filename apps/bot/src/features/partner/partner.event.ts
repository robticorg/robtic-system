import { Events } from "discord.js";
import type { EventConfig } from "@typings/event";
import { isFeatureEnabled } from "@core/features";
import { handleError, BotError } from "@core/handlers";
import { PartnerServerRepository } from "@database/repositories";
import { grantPartnerRole } from "./utils/partner-role";

/**
 * A representative added before they were in the server gets the partner role the moment they
 * join (and again after a rejoin, since leaving strips every role).
 */
export default {
    name: Events.GuildMemberAdd,
    execute: async member => {
        if (member.user.bot) return;

        try {
            if (!(await isFeatureEnabled(member.guild.id, "partner"))) return;
            if (await PartnerServerRepository.countByRepresentative(member.guild.id, member.id) === 0) return;
            await grantPartnerRole(member.guild, member.id);
        } catch (err) {
            handleError(new BotError(`Failed to give a joining representative the partner role: ${err}`, "EVENT"), "main/partner");
        }
    },
} satisfies EventConfig<Events.GuildMemberAdd>;
