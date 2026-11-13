import { EmbedBuilder, Events, type GuildMember } from "discord.js";
import { COLORS } from "@constants";
import { detectRoleAuditEntry, recordSecurityEvent, sendAuditLog } from "../../utils/moderation/security";
import { sendToServerLog } from "@bot/utils/server-log";
import type { BotClient } from "@core/bot-client";

import { L } from "@utils";
export default {
    name: Events.GuildMemberUpdate,
    async execute(oldMember: GuildMember, newMember: GuildMember, client: BotClient) {
        const added = newMember.roles.cache.filter((role) => !oldMember.roles.cache.has(role.id));
        const removed = oldMember.roles.cache.filter((role) => !newMember.roles.cache.has(role.id));

        if (added.size === 0 && removed.size === 0) return;

        const audit = await detectRoleAuditEntry(newMember.guild, newMember.id);

        const embed = new EmbedBuilder()
            .setTitle(L("📘 Member roles changed", "📘 تغيير رتب عضو"))
            .setColor(COLORS.warning)
            .addFields(
                { name: L("Target", "المستهدف"), value: `<@${newMember.id}> (${newMember.id})` },
                {
                    name: L("Roles added", "رتب مضافة"),
                    value: added.size > 0 ? added.map((role) => `<@&${role.id}>`).join(", ") : "none",
                },
                {
                    name: L("Roles removed", "رتب مسحوبة"),
                    value: removed.size > 0 ? removed.map((role) => `<@&${role.id}>`).join(", ") : "none",
                },
                { name: L("By", "بواسطة"), value: audit?.executorId ? `<@${audit.executorId}> (${audit.executorId})` : L("Unknown", "غير معروف") },
                { name: L("Reason", "السبب"), value: audit?.reason ?? L("No reason given", "بدون سبب") },
            )
            .setTimestamp();

        await sendAuditLog(newMember.guild, "role_update", embed);
        await sendToServerLog(client, newMember.guild.id, "member-role-update", embed);

        if (!audit?.executorId) return;

        if (added.size > 0) {
            await recordSecurityEvent({
                client,
                guild: newMember.guild,
                event: "role_grant",
                executorId: audit.executorId,
                targetId: newMember.id,
                source: "event:guildMemberUpdate",
                details: `added=${added.map((role) => role.id).join(",")}`,
            });
        }

        if (removed.size > 0) {
            await recordSecurityEvent({
                client,
                guild: newMember.guild,
                event: "role_remove",
                executorId: audit.executorId,
                targetId: newMember.id,
                source: "event:guildMemberUpdate",
                details: `removed=${removed.map((role) => role.id).join(",")}`,
            });
        }
    },
};
