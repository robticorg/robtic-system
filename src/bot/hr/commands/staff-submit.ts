import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
} from "discord.js";
import type { BotClient } from "@core/BotClient";
import { Colors, ROLE_MAP } from "@core/config";
import { StaffRepository, SubmitConfigRepository } from "@database/repositories";
import { departments } from "../config/departments";
import { updatePanel } from "../utils/updatePanel";

const DEPT_EMOJI: Record<string, string> = {
    Dev: "💻",
    Design: "🎨",
    Moderation: "🛡️",
    Community: "💬",
    Events: "🎉",
    Support: "🎫",
    HR: "👥",
};

function getManagerRoleId(department: Department): string | null {
    const entry = Object.entries(ROLE_MAP).find(
        ([key, v]) => v.department === department && key.includes("Manager")
    );
    return entry?.[1].ids[0] ?? null;
}

export default {
    data: new SlashCommandBuilder()
        .setName("staff-submit")
        .setDescription("Manage staff submission fields")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub
                .setName("open")
                .setDescription("Open a department for applications")
                .addStringOption(opt =>
                    opt
                        .setName("department")
                        .setDescription("Department to open")
                        .setRequired(true)
                        .addChoices(...departments.map(d => ({ name: d.name, value: d.name })))
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("close")
                .setDescription("Close a department from accepting applications")
                .addStringOption(opt =>
                    opt
                        .setName("department")
                        .setDescription("Department to close")
                        .setRequired(true)
                        .addChoices(...departments.map(d => ({ name: d.name, value: d.name })))
                )
        )
        .addSubcommand(sub =>
            sub.setName("status").setDescription("Show all departments status and staff count")
        ),

    async run(interaction: ChatInputCommandInteraction, client: BotClient) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId!;

        if (sub === "open") {
            const department = interaction.options.getString("department", true) as Department;

            const config = await SubmitConfigRepository.get(guildId);
            if (!config?.reviewChannelId) {
                await interaction.reply({
                    content: "❌ Set the review channel first with `/setup-submit channel`.",
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            if (config.openDepartments.includes(department)) {
                await interaction.reply({
                    content: `⚠️ **${department}** is already open.`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const updated = await SubmitConfigRepository.openDepartment(guildId, department);
            if (updated) await updatePanel(client, updated);

            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(`${DEPT_EMOJI[department]} ${department} — Opened`)
                        .setDescription(`Applications for **${department}** are now open. The panel has been updated.`)
                        .setColor(Colors.success),
                ],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (sub === "close") {
            const department = interaction.options.getString("department", true) as Department;

            const config = await SubmitConfigRepository.get(guildId);
            if (!config?.openDepartments.includes(department)) {
                await interaction.reply({
                    content: `⚠️ **${department}** is already closed.`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const updated = await SubmitConfigRepository.closeDepartment(guildId, department);
            if (updated) await updatePanel(client, updated);

            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(`🔒 ${department} — Closed`)
                        .setDescription(`Applications for **${department}** are now closed and removed from the panel.`)
                        .setColor(Colors.error),
                ],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (sub === "status") {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const config = await SubmitConfigRepository.get(guildId);
            const openDepts = config?.openDepartments ?? [];

            const staffCounts = await Promise.all(
                departments.map(async d => ({
                    name: d.name,
                    count: (await StaffRepository.findByDepartment(d.name)).length,
                }))
            );

            const countMap = Object.fromEntries(staffCounts.map(s => [s.name, s.count]));

            const fields = departments.map(d => {
                const isOpen = openDepts.includes(d.name);
                const managerRoleId = getManagerRoleId(d.name as Department);
                const manager = managerRoleId ? `<@&${managerRoleId}>` : "—";
                const staffCount = countMap[d.name] ?? 0;

                return {
                    name: `${DEPT_EMOJI[d.name] ?? "📋"} ${d.name}`,
                    value: [
                        `Status: ${isOpen ? "✅ Open" : "🔒 Closed"}`,
                        `Staff: \`${staffCount}\``,
                        `Manager: ${manager}`,
                    ].join("\n"),
                    inline: true,
                };
            });

            const reviewChannelMention = config?.reviewChannelId ? `<#${config.reviewChannelId}>` : "Not set";
            const panelChannelMention = config?.panelChannelId ? `<#${config.panelChannelId}>` : "Not set";

            const embed = new EmbedBuilder()
                .setTitle("📊 Submission System Status")
                .addFields(fields)
                .addFields(
                    { name: "Review Channel", value: reviewChannelMention, inline: true },
                    { name: "Panel Channel", value: panelChannelMention, inline: true },
                )
                .setColor(Colors.info)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }
    },
};
