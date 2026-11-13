import { AuditLogEvent, EmbedBuilder, Events, type Role } from "discord.js";
import type { BotClient } from "@core/bot-client";
import { COLORS } from "@constants";
import { sendToServerLog } from "@bot/utils/server-log";

import { L } from "@utils";
export default {
    name: Events.GuildRoleUpdate,
    async execute(oldRole: Role, newRole: Role, client: BotClient) {
        const changes: string[] = [];
        if (oldRole.name !== newRole.name) changes.push(L(`Name: \`${oldRole.name}\` → \`${newRole.name}\``, `الاسم: \`${oldRole.name}\` ← \`${newRole.name}\``));
        if (oldRole.color !== newRole.color) changes.push(L(`Colour: \`${oldRole.hexColor}\` → \`${newRole.hexColor}\``, `اللون: \`${oldRole.hexColor}\` ← \`${newRole.hexColor}\``));
        if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) changes.push(L("Permissions changed", "تغيرت الصلاحيات"));
        if (oldRole.mentionable !== newRole.mentionable) changes.push(L(`Mentionable: ${oldRole.mentionable} → ${newRole.mentionable}`, `قابلة للمنشن: ${oldRole.mentionable} ← ${newRole.mentionable}`));
        if (oldRole.hoist !== newRole.hoist) changes.push(L(`Hoisted: ${oldRole.hoist} → ${newRole.hoist}`, `تظهر منفصلة: ${oldRole.hoist} ← ${newRole.hoist}`));

        if (changes.length === 0) return;

        const logs = await newRole.guild.fetchAuditLogs({ type: AuditLogEvent.RoleUpdate, limit: 6 }).catch(() => null);
        const entry = logs?.entries.find(e => Date.now() - e.createdTimestamp < 15_000);
        const executorId = entry?.executor?.id;

        const embed = new EmbedBuilder()
            .setTitle(L("📘 Role changed", "📘 تعديل رتبة"))
            .setColor(COLORS.warning)
            .addFields(
                { name: L("Role", "الرتبة"), value: `<@&${newRole.id}> (\`${newRole.id}\`)` },
                { name: L("Changes", "التغييرات"), value: changes.join("\n") },
                { name: L("By", "بواسطة"), value: executorId ? `<@${executorId}> (${executorId})` : L("Unknown", "غير معروف"), inline: true },
            )
            .setTimestamp();

        await sendToServerLog(client, newRole.guild.id, "role-update", embed);
    },
};
