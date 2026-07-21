import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    RoleSelectMenuBuilder,
    type BaseMessageOptions,
} from "discord.js";
import { Colors } from "@core/config";
import type { ISubmissionType } from "@database/models/SubmissionType";

export function buildConfigPanel(type: ISubmissionType): BaseMessageOptions {
    const grantRoles = type.grantRoleIds.length
        ? type.grantRoleIds.map(id => `<@&${id}>`).join(", ")
        : "*None set*";

    const managerRoles = type.managerRoleIds.length
        ? type.managerRoleIds.map(id => `<@&${id}>`).join(", ")
        : "*None set*";

    const questions = type.questions.length
        ? type.questions.map((q, i) => `**${i + 1}.** ${q.question}`).join("\n")
        : "*No questions configured*";

    const embed = new EmbedBuilder()
        .setTitle(`⚙️ Configuring: ${type.name}`)
        .setColor(Colors.info)
        .addFields(
            { name: "Status", value: type.isOpen ? "✅ Open" : "🔒 Closed", inline: true },
            { name: "Grant Roles", value: grantRoles, inline: false },
            { name: "Manager Roles", value: managerRoles, inline: false },
            { name: "Questions (max 5)", value: questions, inline: false },
        )
        .setFooter({ text: `Key: ${type.key}` });

    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`submit-config-rename_${type.key}`)
            .setLabel("Rename")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`submit-config-questions_${type.key}`)
            .setLabel("Edit Questions")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`submit-config-toggle_${type.key}`)
            .setLabel(type.isOpen ? "Close" : "Open")
            .setStyle(type.isOpen ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`submit-config-delete_${type.key}`)
            .setLabel("Delete")
            .setStyle(ButtonStyle.Danger),
    );

    const grantRoleRow = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
        new RoleSelectMenuBuilder()
            .setCustomId(`submit-config-grant-roles_${type.key}`)
            .setPlaceholder("Select roles to grant on acceptance")
            .setMinValues(0)
            .setMaxValues(10)
            .setDefaultRoles(type.grantRoleIds)
    );

    const managerRoleRow = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
        new RoleSelectMenuBuilder()
            .setCustomId(`submit-config-manager-roles_${type.key}`)
            .setPlaceholder("Select manager roles who can accept/reject")
            .setMinValues(0)
            .setMaxValues(10)
            .setDefaultRoles(type.managerRoleIds)
    );

    return { embeds: [embed], components: [buttonRow, grantRoleRow, managerRoleRow] };
}

export function buildDeleteConfirmPanel(type: ISubmissionType): BaseMessageOptions {
    const embed = new EmbedBuilder()
        .setTitle(`⚠️ Delete "${type.name}"?`)
        .setDescription("This will permanently remove this submission type and its configuration. This cannot be undone.")
        .setColor(Colors.error);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`submit-config-delete-yes_${type.key}`)
            .setLabel("Yes, delete it")
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`submit-config-delete-no_${type.key}`)
            .setLabel("Cancel")
            .setStyle(ButtonStyle.Secondary),
    );

    return { embeds: [embed], components: [row] };
}
