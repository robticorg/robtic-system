import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    type ChatInputCommandInteraction,
    type GuildMember,
    type Role,
} from "discord.js";
import type { BotClient } from "@core/bot-client";
import { AUDIT_MESSAGES as AUDIT, COLORS, MODERATION_ACTION_MESSAGES as MSG } from "@constants";
import { L } from "@utils";
import { recordSecurityEvent, sendAuditLog } from "@bot/utils/moderation/security";
import { canActOn, checkRoleAssignable } from "@bot/utils/moderation/hierarchy";

type Who = "human" | "bot" | "both";

/** Servers with a /role multiple running: one at a time each, so two runs can't fight over the same members. */
const running = new Set<string>();
const PROGRESS_EVERY_MS = 3000;
const n = (x: number) => x.toLocaleString("en-US");

async function auditRoleChange(
    interaction: ChatInputCommandInteraction,
    client: BotClient,
    target: GuildMember,
    role: Role,
    granted: boolean,
): Promise<void> {
    const guild = interaction.guild!;
    await sendAuditLog(
        guild,
        "role_update",
        new EmbedBuilder()
            .setTitle(granted ? L("📘 Role given", "📘 إعطاء رتبة") : L("📘 Role removed", "📘 سحب رتبة"))
            .setColor(granted ? COLORS.success : COLORS.warning)
            .addFields(
                { name: AUDIT.targetFieldName, value: `<@${target.id}> (${target.id})` },
                { name: AUDIT.executorFieldName, value: `<@${interaction.user.id}> (${interaction.user.id})` },
                { name: L("Role", "الرتبة"), value: `<@&${role.id}>` },
                { name: L("Source", "المصدر"), value: `/role ${interaction.options.getSubcommand()}`, inline: true },
            )
            .setTimestamp(),
    );
    await recordSecurityEvent({
        client, guild, event: granted ? "role_grant" : "role_remove", executorId: interaction.user.id, targetId: target.id,
        source: `command:/role ${interaction.options.getSubcommand()}`, details: `${role.name} (${role.id})`,
    });
}

export default {
    scope: "guild",
    category: "Moderation",
    data: new SlashCommandBuilder()
        .setName("role")
        .setDescription("Give or take a role")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommand(sub =>
            sub.setName("give")
                .setDescription("Give a role to a member")
                .addUserOption(opt => opt.setName("user").setDescription("The member").setRequired(true))
                .addRoleOption(opt => opt.setName("role").setDescription("The role to give").setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName("remove")
                .setDescription("Remove a role from a member")
                .addUserOption(opt => opt.setName("user").setDescription("The member").setRequired(true))
                .addRoleOption(opt => opt.setName("role").setDescription("The role to remove").setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName("multiple")
                .setDescription("Add or remove one role for many members at once")
                .addStringOption(opt => opt.setName("type").setDescription("Add the role or remove it").setRequired(true)
                    .addChoices({ name: "Add", value: "add" }, { name: "Remove", value: "remove" }))
                .addStringOption(opt => opt.setName("who").setDescription("Which members").setRequired(true)
                    .addChoices({ name: "Humans", value: "human" }, { name: "Bots", value: "bot" }, { name: "Both", value: "both" }))
                .addRoleOption(opt => opt.setName("role").setDescription("The role to add or remove").setRequired(true))
                .addRoleOption(opt => opt.setName("with").setDescription("Optional: only members who have this role").setRequired(false))
                .addRoleOption(opt => opt.setName("without").setDescription("Optional: only members who don't have this role").setRequired(false))
        ),

    requiredPermission: 60,

    async run(interaction: ChatInputCommandInteraction, client: BotClient) {
        const guild = interaction.guild;
        const refuse = (content: string) => interaction.reply({ content, flags: MessageFlags.Ephemeral });
        if (!guild) return void await refuse(MSG.guildOnly);

        const sub = interaction.options.getSubcommand();
        const executor = interaction.member as GuildMember;
        const role = interaction.options.getRole("role", true) as Role;

        const blocked = checkRoleAssignable(guild, executor, role);
        if (blocked) return void await refuse(blocked);

        if (sub === "multiple") return void await runMultiple(interaction, client, executor, role);

        const targetUser = interaction.options.getUser("user", true);
        const target = guild.members.cache.get(targetUser.id) ?? await guild.members.fetch(targetUser.id).catch(() => null);
        if (!target) return void await refuse(MSG.notInGuild);

        // Taking a role away is acting on the person: not someone at or above you (giving one is not).
        if (sub === "remove" && target.id !== executor.id && !canActOn(executor, target)) {
            return void await refuse(L("You can't take roles from someone whose highest role is at or above your own.", "ما تقدر تسحب رتب من شخص رتبته أعلى من رتبتك أو تساويها."));
        }

        const has = target.roles.cache.has(role.id);
        if (sub === "give" && has) return void await refuse(MSG.roleAlreadyHas(targetUser.username, role.name));
        if (sub === "remove" && !has) return void await refuse(MSG.roleDoesNotHave(targetUser.username, role.name));

        await interaction.deferReply();
        const reason = `${interaction.user.tag}: /role ${sub}`;
        const changed = sub === "give"
            ? await target.roles.add(role, reason).catch(() => null)
            : await target.roles.remove(role, reason).catch(() => null);
        if (!changed) return void await interaction.editReply({ content: MSG.roleFailed });

        await interaction.editReply({
            content: sub === "give" ? MSG.roleGiven(targetUser.username, role.name) : MSG.roleRemoved(targetUser.username, role.name),
        });
        await auditRoleChange(interaction, client, target, role, sub === "give");
    },
};

/**
 * /role multiple: one role added to, or removed from, every member that fits (humans, bots or both; optionally only
 * those with, or without, another role). Starts at once, shows progress with a Stop button, and writes one summary to
 * the audit log instead of one entry per member.
 */
async function runMultiple(interaction: ChatInputCommandInteraction, client: BotClient, executor: GuildMember, role: Role) {
    const guild = interaction.guild!;
    const adding = interaction.options.getString("type", true) === "add";
    const who = interaction.options.getString("who", true) as Who;
    const withRole = interaction.options.getRole("with") as Role | null;
    const withoutRole = interaction.options.getRole("without") as Role | null;

    if (running.has(guild.id)) {
        await interaction.reply({ content: L("A /role multiple is already running in this server. Wait for it to finish, or stop it.", "في /role multiple شغال في السيرفر. انتظر لين يخلص أو أوقفه."), flags: MessageFlags.Ephemeral });
        return;
    }
    if (role.managed || role.id === guild.id) {
        await interaction.reply({ content: L("That role can't be given or taken by hand.", "هذي الرتبة ما تنعطى ولا تنسحب يدويًا."), flags: MessageFlags.Ephemeral });
        return;
    }

    running.add(guild.id);
    try {
        await interaction.deferReply();
        const members = await guild.members.fetch().catch(() => null);
        if (!members) {
            await interaction.editReply({ content: L("Couldn't load the member list. Try again in a minute.", "ما قدرت أجيب قائمة الأعضاء. حاول بعد دقيقة.") });
            return;
        }

        let protectedCount = 0;
        const targets = [...members.values()].filter(m => {
            if (who === "human" && m.user.bot) return false;
            if (who === "bot" && !m.user.bot) return false;
            if (withRole && !m.roles.cache.has(withRole.id)) return false;
            if (withoutRole && m.roles.cache.has(withoutRole.id)) return false;
            if (adding === m.roles.cache.has(role.id)) return false; // already as wanted
            // Taking a role away acts on the member: never someone at or above the one running it.
            if (!adding && m.id !== executor.id && !canActOn(executor, m)) { protectedCount++; return false; }
            return true;
        });

        const whoText = who === "human" ? L("humans", "البشر") : who === "bot" ? L("bots", "البوتات") : L("members", "الأعضاء");
        const filterText = [
            withRole ? L(`with <@&${withRole.id}>`, `اللي عندهم <@&${withRole.id}>`) : "",
            withoutRole ? L(`without <@&${withoutRole.id}>`, `اللي ما عندهم <@&${withoutRole.id}>`) : "",
        ].filter(Boolean).join(L(" and ", " و"));

        if (!targets.length) {
            await interaction.editReply({
                content: (adding
                    ? L(`Every ${whoText} that fits already has <@&${role.id}>.`, `كل ${whoText} المطابقين عندهم <@&${role.id}> من قبل.`)
                    : L(`No ${whoText} that fit have <@&${role.id}>.`, `ما في ${whoText} مطابقين عندهم <@&${role.id}>.`))
                    + (protectedCount ? `\n${L(`${n(protectedCount)} skipped: their highest role is at or above yours.`, `${n(protectedCount)} تم تخطيهم: رتبتهم أعلى من رتبتك أو تساويها.`)}` : ""),
                allowedMentions: { parse: [] },
            });
            return;
        }

        let done = 0;
        let failed = 0;
        let stopped = false;
        const stopId = `role-multiple-stop:${interaction.id}`;
        const stopRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(stopId).setLabel(L("Stop", "إيقاف")).setStyle(ButtonStyle.Danger),
        );
        const line = () => {
            const verb = adding ? L(`Adding <@&${role.id}> to`, `إضافة <@&${role.id}> لـ`) : L(`Removing <@&${role.id}> from`, `سحب <@&${role.id}> من`);
            return `${verb} ${n(targets.length)} ${whoText}${filterText ? ` ${filterText}` : ""}: **${n(done)}/${n(targets.length)}**`
                + (failed ? ` · ${L(`${n(failed)} failed`, `${n(failed)} فشل`)}` : "");
        };

        const reply = await interaction.editReply({ content: `⏳ ${line()}`, components: [stopRow], allowedMentions: { parse: [] } });
        // An interaction's reply can only be edited through it for 15 minutes; a long run edits the message itself after.
        const startedAt = Date.now();
        const update = (body: { content: string; components?: ActionRowBuilder<ButtonBuilder>[] }) =>
            (Date.now() - startedAt < 14 * 60_000
                ? interaction.editReply({ ...body, allowedMentions: { parse: [] } })
                : reply.edit({ ...body, allowedMentions: { parse: [] } })).catch(() => undefined);
        const collector = reply.createMessageComponentCollector({ componentType: ComponentType.Button, time: 6 * 60 * 60 * 1000 });
        collector.on("collect", async btn => {
            if (btn.customId !== stopId) return;
            if (btn.user.id !== interaction.user.id && !(btn.member as GuildMember | null)?.permissions.has(PermissionFlagsBits.ManageRoles)) {
                await btn.reply({ content: L("Only whoever started it, or someone with Manage Roles, can stop it.", "يوقفه اللي شغله فقط، أو من عنده صلاحية إدارة الرتب."), flags: MessageFlags.Ephemeral });
                return;
            }
            stopped = true;
            await btn.deferUpdate().catch(() => {});
        });

        const reason = `${interaction.user.tag}: /role multiple ${adding ? "add" : "remove"}`;
        let lastEdit = Date.now();
        for (const member of targets) {
            if (stopped) break;
            const ok = adding
                ? await member.roles.add(role, reason).then(() => true, () => false)
                : await member.roles.remove(role, reason).then(() => true, () => false);
            if (ok) done++; else failed++;
            if (Date.now() - lastEdit > PROGRESS_EVERY_MS) {
                lastEdit = Date.now();
                await update({ content: `⏳ ${line()}` });
            }
        }
        collector.stop();

        const head = stopped ? `⏹️ ${L("Stopped.", "تم الإيقاف.")}` : `✅ ${L("Done.", "تم.")}`;
        await update({
            content: `${head} ${line()}`
                + (protectedCount ? `\n${L(`${n(protectedCount)} skipped: their highest role is at or above yours.`, `${n(protectedCount)} تم تخطيهم: رتبتهم أعلى من رتبتك أو تساويها.`)}` : ""),
            components: [],
        });

        await sendAuditLog(guild, "role_update", new EmbedBuilder()
            .setTitle(adding ? L("📘 Role given to many members", "📘 إعطاء رتبة لعدة أعضاء") : L("📘 Role removed from many members", "📘 سحب رتبة من عدة أعضاء"))
            .setColor(adding ? COLORS.success : COLORS.warning)
            .addFields(
                { name: L("Role", "الرتبة"), value: `<@&${role.id}>`, inline: true },
                { name: L("Members", "الأعضاء"), value: `${n(done)} ${L("changed", "تغيروا")}${failed ? ` · ${n(failed)} ${L("failed", "فشل")}` : ""}${stopped ? ` · ${L("stopped early", "توقف قبل النهاية")}` : ""}`, inline: true },
                { name: L("Who", "مين"), value: `${whoText}${filterText ? ` ${filterText}` : ""}` },
                { name: AUDIT.executorFieldName, value: `<@${interaction.user.id}> (${interaction.user.id})` },
            )
            .setTimestamp());
        await recordSecurityEvent({
            client, guild, event: adding ? "role_grant" : "role_remove", executorId: interaction.user.id,
            source: "command:/role multiple", details: `${role.name} (${role.id}) · ${done} member(s)${stopped ? " · stopped" : ""}`,
        });
    } finally {
        running.delete(guild.id);
    }
}
