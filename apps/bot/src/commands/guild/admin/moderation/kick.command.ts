import {
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
    type ChatInputCommandInteraction,
    type GuildMember,
} from "discord.js";
import { AUDIT_MESSAGES as AUDIT, COLORS, MODERATION_ACTION_MESSAGES as MSG } from "@constants";
import { L, errorText } from "@utils";
import type { BotClient } from "@core/bot-client";
import { recordSecurityEvent, sendAuditLog } from "@bot/utils/moderation/security";
import { canActOn } from "@bot/utils/moderation/hierarchy";

/**
 * Kicks a member. Checked the same way `/ban` is: not yourself, not the bot, not someone at or above your own highest
 * role, and only when the bot can actually do it. It says it kicked only when Discord did.
 */
export default {
    scope: "guild",
    category: "Moderation",
    data: new SlashCommandBuilder()
        .setName("kick")
        .setDescription("Kick a member from the server")
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .addUserOption(opt => opt.setName("target").setDescription("Member to kick").setRequired(true))
        .addStringOption(opt => opt.setName("reason").setDescription("Why they are being kicked").setRequired(false).setMaxLength(400)),

    requiredPermission: 60,

    async run(interaction: ChatInputCommandInteraction, client: BotClient) {
        const guild = interaction.guild;
        if (!guild) {
            await interaction.reply({ content: MSG.guildOnly, flags: MessageFlags.Ephemeral });
            return;
        }

        const target = interaction.options.getUser("target", true);
        const reason = interaction.options.getString("reason")?.trim() || AUDIT.noReasonProvided;
        const refuse = (content: string) => interaction.reply({ content: errorText(content), flags: MessageFlags.Ephemeral });

        if (target.id === interaction.user.id) return void await refuse(L("You can't kick yourself.", "ما تقدر تطرد نفسك."));
        if (target.id === client.user?.id) return void await refuse(L("You can't kick me.", "ما تقدر تطردني."));
        if (!guild.members.me?.permissions.has(PermissionFlagsBits.KickMembers)) return void await refuse(MSG.kickMissingPermission);

        const member = guild.members.cache.get(target.id) ?? await guild.members.fetch(target.id).catch(() => null);
        if (!member) return void await refuse(MSG.notInGuild);
        if (!canActOn(interaction.member as GuildMember, member)) {
            return void await refuse(L("You can't kick someone whose highest role is at or above your own.", "ما تقدر تطرد شخص رتبته أعلى من رتبتك أو تساويها."));
        }
        if (!member.kickable) return void await refuse(L("I can't kick that member: their highest role is above mine.", "ما أقدر أطرد هذا العضو: أعلى رتبة عنده فوق رتبتي."));

        await interaction.deferReply();

        const kicked = await member.kick(`${interaction.user.tag}: ${reason}`.slice(0, 512)).then(() => true, () => false);
        if (!kicked) {
            await interaction.editReply({ content: errorText(L("The kick failed. Check my role position and permissions.", "فشل الطرد. تأكد من ترتيب رتبتي وصلاحياتي.")) });
            return;
        }

        await interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setTitle(L("👢 Member kicked", "👢 تم طرد عضو"))
                    .setColor(COLORS.moderation)
                    .addFields(
                        { name: AUDIT.targetFieldName, value: `<@${target.id}> (${target.id})` },
                        { name: L("Moderator", "المشرف"), value: `<@${interaction.user.id}> (${interaction.user.id})` },
                        { name: AUDIT.reasonFieldName, value: reason },
                    )
                    .setTimestamp(),
            ],
        });

        await sendAuditLog(
            guild,
            "member_kick",
            new EmbedBuilder()
                .setTitle(AUDIT.memberKickTitle)
                .setColor(COLORS.warning)
                .addFields(
                    { name: AUDIT.targetFieldName, value: `<@${target.id}> (${target.id})` },
                    { name: AUDIT.executorFieldName, value: `<@${interaction.user.id}> (${interaction.user.id})` },
                    { name: AUDIT.reasonFieldName, value: reason },
                    { name: L("Source", "المصدر"), value: "/kick", inline: true },
                )
                .setTimestamp(),
        );

        await recordSecurityEvent({
            client,
            guild,
            event: "kick",
            executorId: interaction.user.id,
            targetId: target.id,
            source: "command:/kick",
            details: reason,
        });
    },
};
