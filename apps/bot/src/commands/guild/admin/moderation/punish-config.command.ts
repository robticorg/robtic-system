import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    ChannelType,
    EmbedBuilder,
    MessageFlags,
    type GuildMember,
} from "discord.js";
import { COLORS } from "@constants";
import { L, errorText } from "@utils";
import { getMemberLevel, isManager } from "@bot/utils/access";
import { PunishConfigRepository } from "@database/repositories";

const MAX_POINTS_PER_ACTION = 100;

async function managerOnly(member: GuildMember): Promise<boolean> {
    const { score } = await getMemberLevel(member);
    if (score >= 90) return true;
    return isManager(member);
}

export default {
    scope: "guild",
    category: "Configuration",
    data: new SlashCommandBuilder()
        .setName("punish-config")
        .setDescription("Configure ban/mute/warn shortcuts, proof channel, and moderation points")
        .addSubcommand(sub =>
            sub.setName("role-add").setDescription("Allow a role to use ban/mute/warn shortcuts")
                .addRoleOption(opt => opt.setName("role").setDescription("Role to allow").setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName("role-remove").setDescription("Remove a role's shortcut access")
                .addRoleOption(opt => opt.setName("role").setDescription("Role to remove").setRequired(true))
        )
        .addSubcommand(sub => sub.setName("role-list").setDescription("List roles allowed to use punishment shortcuts"))
        .addSubcommand(sub =>
            sub.setName("points-set").setDescription("Set how many staff points a warn/mute awards the moderator")
                .addIntegerOption(opt => opt.setName("amount").setDescription(`Points per action (0 to ${MAX_POINTS_PER_ACTION})`).setRequired(true).setMinValue(0).setMaxValue(MAX_POINTS_PER_ACTION))
        )
        .addSubcommand(sub =>
            sub.setName("proof-channel-set").setDescription("Set the channel where proof/evidence images are posted")
                .addChannelOption(opt =>
                    opt.setName("channel").setDescription("Proof channel").setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                )
        )
        .addSubcommand(sub => sub.setName("status").setDescription("Show current punish-config settings")),

    requiredPermission: 80,

    async run(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) return;

        if (!(await managerOnly(interaction.member as GuildMember))) {
            await interaction.reply({ content: errorText(L("Only managers can use this command.", "هذا الأمر للمدراء فقط.")), flags: MessageFlags.Ephemeral });
            return;
        }

        const guildId = interaction.guildId;
        const sub = interaction.options.getSubcommand();
        const done = (description: string) => interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.success).setDescription(description)] });

        if (sub === "points-set") {
            const amount = interaction.options.getInteger("amount", true);
            // A prefix command skips Discord's own min/max.
            if (!Number.isInteger(amount) || amount < 0 || amount > MAX_POINTS_PER_ACTION) {
                await interaction.reply({ content: errorText(L(`Points must be 0 to ${MAX_POINTS_PER_ACTION}.`, `النقاط لازم تكون من 0 إلى ${MAX_POINTS_PER_ACTION}.`)), flags: MessageFlags.Ephemeral });
                return;
            }
            await interaction.deferReply();
            await PunishConfigRepository.setPointsPerAction(guildId, amount);
            await done(L(`Each warn or mute now gives the moderator **${amount}** point(s).`, `كل تحذير أو ميوت صار يعطي المشرف **${amount}** نقطة.`));
            return;
        }

        await interaction.deferReply();

        if (sub === "role-add") {
            const role = interaction.options.getRole("role", true);
            await PunishConfigRepository.addShortcutRole(guildId, role.id);
            await done(L(`<@&${role.id}> can now use the punishment shortcuts.`, `<@&${role.id}> صار يقدر يستخدم اختصارات العقوبات.`));
            return;
        }

        if (sub === "role-remove") {
            const role = interaction.options.getRole("role", true);
            await PunishConfigRepository.removeShortcutRole(guildId, role.id);
            await done(L(`<@&${role.id}> can no longer use the punishment shortcuts.`, `<@&${role.id}> ما عاد يقدر يستخدم اختصارات العقوبات.`));
            return;
        }

        if (sub === "proof-channel-set") {
            const channel = interaction.options.getChannel("channel", true);
            await PunishConfigRepository.setProofChannel(guildId, channel.id);
            await done(L(`Proof images now go to <#${channel.id}>.`, `صور الأدلة صارت تروح لـ <#${channel.id}>.`));
            return;
        }

        // status (and role-list, which the status shows).
        const config = await PunishConfigRepository.findOrCreate(guildId);
        await interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setTitle(L("🔧 Punishment settings", "🔧 إعدادات العقوبات"))
                    .setColor(COLORS.info)
                    .addFields(
                        { name: L("Shortcut roles", "رتب الاختصارات"), value: config.shortcutRoleIds.length ? config.shortcutRoleIds.map(id => `<@&${id}>`).join(", ") : L("None", "لا يوجد") },
                        { name: L("Points per warn/mute", "النقاط لكل تحذير/ميوت"), value: `${config.pointsPerAction}`, inline: true },
                        { name: L("Proof channel", "روم الأدلة"), value: config.proofChannelId ? `<#${config.proofChannelId}>` : L("Not set", "غير محدد"), inline: true },
                    )
                    .setTimestamp(),
            ],
        });
    },
};
