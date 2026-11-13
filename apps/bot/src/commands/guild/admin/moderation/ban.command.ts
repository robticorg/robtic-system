import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags,
    type ChatInputCommandInteraction,
    type GuildMember,
} from "discord.js";
import type { BotClient } from "@core/bot-client";
import { AUDIT_MESSAGES as AUDIT, COLORS, MODERATION_ACTION_MESSAGES as MSG } from "@constants";
import { L } from "@utils";
import { recordSecurityEvent, sendAuditLog } from "@bot/utils/moderation/security";
import { canActOn } from "@bot/utils/moderation/hierarchy";

/**
 * A real Discord guild ban.
 *
 * `/ban` used to be the punishment-system command that adds a case, punishment points and a
 * timeout — that is `/jail` now. This one puts the user on the guild's ban list and nothing else,
 * which is what everyone expects `/ban` to do.
 */
export default {
    scope: "guild",
    category: "Moderation",
    data: new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Ban a user from the server")
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(opt =>
            opt.setName("target").setDescription("The user to ban").setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName("reason").setDescription("Why they are being banned").setRequired(false).setMaxLength(400)
        ),

    requiredPermission: 60,

    async run(interaction: ChatInputCommandInteraction, client: BotClient) {
        const guild = interaction.guild;
        if (!guild) {
            await interaction.reply({ content: MSG.guildOnly, flags: MessageFlags.Ephemeral });
            return;
        }

        const target = interaction.options.getUser("target", true);
        const reason = interaction.options.getString("reason")?.trim() || AUDIT.noReasonProvided;
        const refuse = (content: string) => interaction.reply({ content, flags: MessageFlags.Ephemeral });

        if (target.id === interaction.user.id) return void await refuse(MSG.banSelf);
        if (target.id === client.user?.id) return void await refuse(MSG.banBot);
        if (!guild.members.me?.permissions.has(PermissionFlagsBits.BanMembers)) return void await refuse(MSG.banMissingPermission);

        const existingBan = await guild.bans.fetch(target.id).catch(() => null);
        if (existingBan) return void await refuse(MSG.alreadyBanned(target.id));

        const member = guild.members.cache.get(target.id) ?? await guild.members.fetch(target.id).catch(() => null);
        if (member) {
            if (!canActOn(interaction.member as GuildMember, member)) return void await refuse(MSG.banAboveExecutor);
            if (!member.bannable) return void await refuse(MSG.banNotBannable);
        }

        await interaction.deferReply();

        const banned = await guild.bans.create(target.id, { reason: `${interaction.user.tag}: ${reason}`.slice(0, 512) }).catch(() => null);
        if (!banned) {
            await interaction.editReply({ content: MSG.banFailed });
            return;
        }

        await interaction.editReply({ content: MSG.banned(target.tag, target.id, reason) });

        await sendAuditLog(
            guild,
            "member_ban",
            new EmbedBuilder()
                .setTitle(AUDIT.memberBanTitle)
                .setColor(COLORS.moderation)
                .addFields(
                    { name: AUDIT.targetFieldName, value: `<@${target.id}> (${target.id})` },
                    { name: AUDIT.executorFieldName, value: `<@${interaction.user.id}> (${interaction.user.id})` },
                    { name: AUDIT.reasonFieldName, value: reason },
                    { name: L("Source", "المصدر"), value: "/ban", inline: true },
                )
                .setTimestamp(),
        );

        await recordSecurityEvent({
            client,
            guild,
            event: "ban",
            executorId: interaction.user.id,
            targetId: target.id,
            source: "command:/ban",
            details: reason,
        });
    },
};
