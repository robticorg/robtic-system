import {
    ChannelType,
    ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder,
    type GuildMember,
} from "discord.js";
import { COLORS, DURATION_SHORTHAND_REGEX } from "@constants";
import { L, errorText } from "@utils";
import { getMemberLevel, isManager } from "@bot/utils/access";
import {
    formatWindow,
    parseWindowToMs,
    type AuditChannelKey,
    type SecurityActionType,
    type SecurityEventType,
    type SecurityRule,
} from "@bot/utils/moderation/config";
import {
    getModerationSecurityConfig,
    saveModerationSecurityConfig,
} from "@bot/utils/moderation/security";

const auditChannelChoices: Array<{ name: string; value: AuditChannelKey }> = [
    { name: "member_join", value: "member_join" },
    { name: "member_leave", value: "member_leave" },
    { name: "member_kick", value: "member_kick" },
    { name: "member_ban", value: "member_ban" },
    { name: "message_delete", value: "message_delete" },
    { name: "channel_create", value: "channel_create" },
    { name: "channel_delete", value: "channel_delete" },
    { name: "role_update", value: "role_update" },
    {name : "generic", value: "generic" },
];

const securityEventChoices: Array<{ name: string; value: SecurityEventType }> = [
    { name: "kick", value: "kick" },
    { name: "ban", value: "ban" },
    { name: "role_grant", value: "role_grant" },
    { name: "role_remove", value: "role_remove" },
    { name: "channel_create", value: "channel_create" },
    { name: "channel_delete", value: "channel_delete" },
];

/** The rule's actions, or null when any of them isn't a known action (they used to be dropped silently). */
function parseActions(raw: string): SecurityActionType[] | null {
    const parts = raw
        .split(",")
        .map((item) => item.trim().toLowerCase().replace(/-/g, "_"))
        .filter(Boolean);

    const valid = new Set<SecurityActionType>(["kick", "ban", "remove_role", "send_alert"]);
    if (!parts.length || parts.some((item) => !valid.has(item as SecurityActionType))) return null;
    return Array.from(new Set(parts as SecurityActionType[]));
}

/** A field holds 1024 characters; a long list is cut with a note rather than breaking the reply. */
function fit(text: string): string {
    return text.length <= 1024 ? text : `${text.slice(0, 1000)}\n…`;
}

async function managerOnly(member: GuildMember): Promise<boolean> {
    const { score } = await getMemberLevel(member);
    if (score >= 90) return true;
    return isManager(member);
}

function describeRule(rule: SecurityRule, index: number): string {
    return `#${index + 1} event=${rule.event} limit=${rule.limit} window=${formatWindow(rule.windowMs)} actions=[${rule.actions.join(", ")}]`;
}

export default {
    scope: "guild",
    category: "Configuration",
    data: new SlashCommandBuilder()
        .setName("security")
        .setDescription("Configure moderation audit and security guard")
        .addSubcommand((sub) =>
            sub
                .setName("status")
                .setDescription("Show current security config")
        )
        .addSubcommand((sub) =>
            sub
                .setName("toggle")
                .setDescription("Enable/disable moderation security")
                .addBooleanOption((opt) =>
                    opt
                        .setName("enabled")
                        .setDescription("Enable security system")
                        .setRequired(true)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("channel-set")
                .setDescription("Set audit/security channel")
                .addStringOption((opt) =>
                    opt
                        .setName("type")
                        .setDescription("Audit log type")
                        .setRequired(true)
                        .addChoices(...auditChannelChoices)
                )
                .addChannelOption((opt) =>
                    opt
                        .setName("channel")
                        .setDescription("Target text channel")
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("channel-security")
                .setDescription("Set security alerts channel")
                .addChannelOption((opt) =>
                    opt
                        .setName("channel")
                        .setDescription("Security alert channel")
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("rule-add")
                .setDescription("Add threshold rule")
                .addStringOption((opt) =>
                    opt
                        .setName("event")
                        .setDescription("Security event")
                        .setRequired(true)
                        .addChoices(...securityEventChoices)
                )
                .addIntegerOption((opt) =>
                    opt
                        .setName("limit")
                        .setDescription("How many actions before trigger")
                        .setRequired(true)
                        .setMinValue(1)
                )
                .addStringOption((opt) =>
                    opt
                        .setName("window")
                        .setDescription("Window like 30s, 1m, 2h")
                        .setRequired(true)
                )
                .addStringOption((opt) =>
                    opt
                        .setName("actions")
                        .setDescription("Comma actions: send_alert,remove_role,kick,ban")
                        .setRequired(true)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("rule-remove")
                .setDescription("Remove threshold rule by index")
                .addStringOption((opt) =>
                    opt
                        .setName("event")
                        .setDescription("Rule event")
                        .setRequired(true)
                        .addChoices(...securityEventChoices)
                )
                .addIntegerOption((opt) =>
                    opt
                        .setName("index")
                        .setDescription("1-based index inside that event")
                        .setRequired(true)
                        .setMinValue(1)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("rule-list")
                .setDescription("List threshold rules")
        )
        .addSubcommand((sub) =>
            sub
                .setName("whitelist-add")
                .setDescription("Whitelist user or role")
                .addUserOption((opt) =>
                    opt
                        .setName("user")
                        .setDescription("User to whitelist")
                        .setRequired(false)
                )
                .addRoleOption((opt) =>
                    opt
                        .setName("role")
                        .setDescription("Role to whitelist")
                        .setRequired(false)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("whitelist-remove")
                .setDescription("Remove user or role from whitelist")
                .addUserOption((opt) =>
                    opt
                        .setName("user")
                        .setDescription("User to remove")
                        .setRequired(false)
                )
                .addRoleOption((opt) =>
                    opt
                        .setName("role")
                        .setDescription("Role to remove")
                        .setRequired(false)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("whitelist-list")
                .setDescription("List whitelisted users/roles")
        )
        .addSubcommand((sub) =>
            sub
                .setName("rolestrip-add")
                .setDescription("Add role to strip list")
                .addRoleOption((opt) =>
                    opt
                        .setName("role")
                        .setDescription("Role to remove on trigger")
                        .setRequired(true)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("rolestrip-remove")
                .setDescription("Remove role from strip list")
                .addRoleOption((opt) =>
                    opt
                        .setName("role")
                        .setDescription("Role to remove from list")
                        .setRequired(true)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("rolestrip-list")
                .setDescription("List strip roles")
        ),

    requiredPermission: 80,

    async run(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId || !interaction.guild) return;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const member = interaction.member as GuildMember;
        if (!(await managerOnly(member))) {
            await interaction.editReply({ content: errorText(L("Only managers can use this command.", "هذا الأمر للمدراء فقط.")) });
            return;
        }

        const sub = interaction.options.getSubcommand();
        const config = await getModerationSecurityConfig(interaction.guildId);
        const done = (description: string) => interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.success).setDescription(description)] });
        const fail = (description: string) => interaction.editReply({ content: errorText(description) });
        const none = L("none", "لا يوجد");
        const notSet = L("Not set", "غير محدد");

        if (sub === "status") {
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(L("🛡️ Security", "🛡️ الحماية"))
                        .setColor(COLORS.info)
                        .addFields(
                            { name: L("On", "مفعّل"), value: config.enabled ? L("Yes", "نعم") : L("No", "لا"), inline: true },
                            { name: L("Rules", "القواعد"), value: String(config.rules.length), inline: true },
                            { name: L("Allowed users", "أعضاء مستثنين"), value: String(config.whitelistUserIds.length), inline: true },
                            { name: L("Allowed roles", "رتب مستثناة"), value: String(config.whitelistRoleIds.length), inline: true },
                            { name: L("Alert channel", "روم التنبيهات"), value: config.settings.securityLogChannelId ? `<#${config.settings.securityLogChannelId}>` : notSet },
                            { name: L("Roles to strip", "رتب تنسحب"), value: fit(config.settings.rolesToStrip.map((id) => `<@&${id}>`).join(", ")) || notSet },
                            { name: L("Rules", "القواعد"), value: fit(config.rules.map((rule, index) => describeRule(rule, index)).join("\n")) || L("No rules yet", "ما في قواعد لين الحين") },
                        )
                        .setTimestamp(),
                ],
            });
            return;
        }

        if (sub === "toggle") {
            config.enabled = interaction.options.getBoolean("enabled", true);
            const saved = await saveModerationSecurityConfig(interaction.guildId, config, interaction.user.id);
            await done(saved.enabled ? L("Security is now **on**.", "الحماية صارت **مفعّلة**.") : L("Security is now **off**.", "الحماية صارت **مقفلة**."));
            return;
        }

        if (sub === "channel-set") {
            const type = interaction.options.getString("type", true) as AuditChannelKey;
            const channel = interaction.options.getChannel("channel", true);
            config.settings.auditChannels[type] = channel.id;
            await saveModerationSecurityConfig(interaction.guildId, config, interaction.user.id);
            await done(L(`**${type}** logs now go to <#${channel.id}>.`, `لوقات **${type}** صارت تروح لـ <#${channel.id}>.`));
            return;
        }

        if (sub === "channel-security") {
            const channel = interaction.options.getChannel("channel", true);
            config.settings.securityLogChannelId = channel.id;
            await saveModerationSecurityConfig(interaction.guildId, config, interaction.user.id);
            await done(L(`Security alerts now go to <#${channel.id}>.`, `تنبيهات الحماية صارت تروح لـ <#${channel.id}>.`));
            return;
        }

        if (sub === "rule-add") {
            const event = interaction.options.getString("event", true) as SecurityEventType;
            const limit = interaction.options.getInteger("limit", true);
            const windowRaw = interaction.options.getString("window", true);
            const actionsRaw = interaction.options.getString("actions", true);

            // Bad input used to be swapped silently for defaults (a 1-minute window, "send_alert"); now it's refused.
            if (!Number.isInteger(limit) || limit < 1) return void await fail(L("The limit must be 1 or more.", "الحد لازم يكون 1 أو أكثر."));
            if (!DURATION_SHORTHAND_REGEX.test(windowRaw.trim().toLowerCase()) || parseWindowToMs(windowRaw) <= 0) {
                return void await fail(L(`\`${windowRaw}\` isn't a window. Use 30s, 5m, 2h or 1d.`, `\`${windowRaw}\` ليست مدة صحيحة. استخدم 30s أو 5m أو 2h أو 1d.`));
            }
            const actions = parseActions(actionsRaw);
            if (!actions) return void await fail(L("Actions are send_alert, remove_role, kick and ban, separated by commas.", "الإجراءات هي send_alert و remove_role و kick و ban، مفصولة بفواصل."));

            const rule: SecurityRule = { event, limit, windowMs: parseWindowToMs(windowRaw), actions };
            config.rules.push(rule);
            await saveModerationSecurityConfig(interaction.guildId, config, interaction.user.id);
            await done(L(`Rule added: ${describeRule(rule, config.rules.length - 1)}`, `تمت إضافة القاعدة: ${describeRule(rule, config.rules.length - 1)}`));
            return;
        }

        if (sub === "rule-remove") {
            const event = interaction.options.getString("event", true) as SecurityEventType;
            const index = interaction.options.getInteger("index", true) - 1;
            const list = config.rules.filter((rule) => rule.event === event);
            if (index < 0 || index >= list.length) return void await fail(L("There's no rule with that number for this event.", "ما في قاعدة بهذا الرقم لهذا الحدث."));

            const selected = list[index]!;
            const globalIndex = config.rules.indexOf(selected);
            if (globalIndex >= 0) config.rules.splice(globalIndex, 1);
            await saveModerationSecurityConfig(interaction.guildId, config, interaction.user.id);
            await done(L(`Rule removed: ${describeRule(selected, index)}`, `تم حذف القاعدة: ${describeRule(selected, index)}`));
            return;
        }

        if (sub === "rule-list") {
            const byEvent = securityEventChoices.map((choice) => {
                const eventRules = config.rules.filter((rule) => rule.event === choice.value);
                return `**${choice.value}**\n${eventRules.length ? eventRules.map((rule, i) => `- ${describeRule(rule, i)}`).join("\n") : `- ${none}`}`;
            });
            await interaction.editReply({
                embeds: [new EmbedBuilder().setTitle(L("Security rules", "قواعد الحماية")).setColor(COLORS.info).setDescription(byEvent.join("\n\n").slice(0, 4000)).setTimestamp()],
            });
            return;
        }

        if (sub === "whitelist-add" || sub === "whitelist-remove") {
            const user = interaction.options.getUser("user", false);
            const role = interaction.options.getRole("role", false);
            if (!user && !role) return void await fail(L("Give a user, a role, or both.", "حدد عضو أو رتبة أو الاثنين."));

            if (sub === "whitelist-add") {
                if (user && !config.whitelistUserIds.includes(user.id)) config.whitelistUserIds.push(user.id);
                if (role && !config.whitelistRoleIds.includes(role.id)) config.whitelistRoleIds.push(role.id);
            } else {
                if (user) config.whitelistUserIds = config.whitelistUserIds.filter((id) => id !== user.id);
                if (role) config.whitelistRoleIds = config.whitelistRoleIds.filter((id) => id !== role.id);
            }
            await saveModerationSecurityConfig(interaction.guildId, config, interaction.user.id);

            const who = `${user ? `<@${user.id}>` : ""} ${role ? `<@&${role.id}>` : ""}`.trim();
            await done(sub === "whitelist-add" ? L(`Now exempt from security: ${who}`, `صار مستثنى من الحماية: ${who}`) : L(`No longer exempt: ${who}`, `ما عاد مستثنى: ${who}`));
            return;
        }

        if (sub === "whitelist-list") {
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(L("Exempt from security", "المستثنين من الحماية"))
                        .setColor(COLORS.info)
                        .addFields(
                            { name: L("Users", "الأعضاء"), value: fit(config.whitelistUserIds.map((id) => `<@${id}>`).join("\n")) || none },
                            { name: L("Roles", "الرتب"), value: fit(config.whitelistRoleIds.map((id) => `<@&${id}>`).join("\n")) || none },
                        )
                        .setTimestamp(),
                ],
            });
            return;
        }

        if (sub === "rolestrip-add") {
            const role = interaction.options.getRole("role", true);
            if (!config.settings.rolesToStrip.includes(role.id)) config.settings.rolesToStrip.push(role.id);
            await saveModerationSecurityConfig(interaction.guildId, config, interaction.user.id);
            await done(L(`<@&${role.id}> will be taken away when a rule triggers.`, `<@&${role.id}> بتنسحب لما تنطبق قاعدة.`));
            return;
        }

        if (sub === "rolestrip-remove") {
            const role = interaction.options.getRole("role", true);
            config.settings.rolesToStrip = config.settings.rolesToStrip.filter((id) => id !== role.id);
            await saveModerationSecurityConfig(interaction.guildId, config, interaction.user.id);
            await done(L(`<@&${role.id}> is off the list.`, `<@&${role.id}> انشالت من القائمة.`));
            return;
        }

        if (sub === "rolestrip-list") {
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(COLORS.info)
                        .setTitle(L("Roles taken away on a trigger", "الرتب اللي تنسحب عند التنبيه"))
                        .setDescription(config.settings.rolesToStrip.map((id) => `<@&${id}>`).join("\n").slice(0, 4000) || L("No roles yet.", "ما في رتب لين الحين.")),
                ],
            });
        }
    },
};
