import { PermissionFlagsBits } from "discord.js";
import type { FeatureSubcommandHandler } from "@typings/feature";
import { ServerConfigRepository } from "@database/repositories";
import { Logger } from "@logger";
import { syncGuildTagRoles, tagRoleProblem } from "../functions/tag-roles";

/**
 * `/tag setup [role] [log]` — this server's tag role and, optionally, the channel where each
 * change is logged. The command states the whole setup: no role turns the tag role off, no log
 * channel means nothing is logged. Members already wearing a tag get the role right away, in the
 * background (a large server takes a while).
 */
export const setup: FeatureSubcommandHandler = async (interaction, _client) => {
    const guild = interaction.guild!;
    const pickedRole = interaction.options.getRole("role");
    const pickedLog = interaction.options.getChannel("log");

    let logChannelId: string | null = null;
    if (pickedLog) {
        const channel = guild.channels.cache.get(pickedLog.id);
        const me = guild.members.me;
        const perms = channel && me ? channel.permissionsFor(me) : null;
        if (!channel?.isSendable() || !perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
            await interaction.editReply({ content: `I need **View Channel**, **Send Messages** and **Embed Links** in <#${pickedLog.id}>.` });
            return;
        }
        logChannelId = channel.id;
    }

    if (!pickedRole) {
        await ServerConfigRepository.setTagSetup(guild.id, null, null);
        await interaction.editReply({
            content: pickedLog
                ? "The tag role is off, so there is nothing to log — pick a role too. Members who already have the role keep it."
                : "The tag role is off. Members who already have the role keep it.",
        });
        return;
    }

    const role = guild.roles.cache.get(pickedRole.id);
    const problem = role ? tagRoleProblem(role) : "I can't find that role.";
    if (!role || problem) {
        await interaction.editReply({ content: problem ?? "I can't find that role.", allowedMentions: { parse: [] } });
        return;
    }

    await ServerConfigRepository.setTagSetup(guild.id, role.id, logChannelId);
    await interaction.editReply({
        content: [
            `Members wearing the server tag of any of my servers now get ${role} here. I'm giving it to everyone who already wears one.`,
            logChannelId ? `Changes are logged in <#${logChannelId}>.` : "No log channel — add `log:` to log each change.",
        ].join("\n"),
        allowedMentions: { parse: [] },
    });

    void syncGuildTagRoles(guild, { roleId: role.id, logChannelId })
        .then(({ given, removed }) => Logger.info(`Tag role set in ${guild.id}: given to ${given}, removed from ${removed}`, "tag"))
        .catch(err => Logger.warn(`Tag role sync after setup failed in ${guild.id}: ${err}`, "tag"));
};
