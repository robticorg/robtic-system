import { Events } from "discord.js";
import type { BotClient } from "@core/bot-client";
import { getModerationSecurityConfig, resolveLogChannel, detectBanAuditEntry, recordSecurityEvent } from "../../utils/moderation/security";
import { memberBanEmbed } from "../../utils/moderation/embed";

import { L } from "@utils";
export default {
    name: Events.GuildBanAdd,
    async execute(ban: any, client: BotClient) {
        const audit = await detectBanAuditEntry(ban.guild, ban.user.id);
        const config = await getModerationSecurityConfig(ban.guild.id);
        const channelId = config.settings.auditChannels.member_ban;
        if (!channelId) return;
        const channel = await resolveLogChannel(ban.guild, channelId);
        if (!channel) return;
        await channel.send({ embeds: [memberBanEmbed(ban, audit?.executorId, ban.reason ?? audit?.reason ?? L("No reason given", "بدون سبب"))] }).catch(() => null);

        if (audit?.executorId) {
            await recordSecurityEvent({
                client,
                guild: ban.guild,
                event: "ban",
                executorId: audit.executorId,
                targetId: ban.user.id,
                source: "event:guildBanAdd",
                details: ban.reason ?? audit.reason,
            });
        }
    },
};
