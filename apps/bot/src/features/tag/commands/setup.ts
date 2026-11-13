import { PermissionFlagsBits } from "discord.js";
import type { FeatureSubcommandHandler } from "@typings/feature";
import { ServerConfigRepository } from "@database/repositories";
import { Logger } from "@logger";
import { syncGuildTagRoles, tagRoleProblem } from "../functions/tag-roles";

import { L } from "@utils";
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
            await interaction.editReply({ content: L(`I need **View Channel**, **Send Messages** and **Embed Links** in <#${pickedLog.id}>.`, `أحتاج **View Channel** و **Send Messages** و **Embed Links** في <#${pickedLog.id}>.`) });
            return;
        }
        logChannelId = channel.id;
    }

    if (!pickedRole) {
        await ServerConfigRepository.setTagSetup(guild.id, null, null);
        await interaction.editReply({
            content: pickedLog
                ? L("The tag role is off, so there's nothing to log: pick a role too. Members who already have the role keep it.", "رتبة التاق مقفلة، فما في شي ينسجل: اختر رتبة بعد. اللي عندهم الرتبة يبقون فيها.")
                : L("The tag role is off. Members who already have the role keep it.", "رتبة التاق مقفلة. اللي عندهم الرتبة يبقون فيها."),
        });
        return;
    }

    const role = guild.roles.cache.get(pickedRole.id);
    const problem = role ? tagRoleProblem(role) : L("I can't find that role.", "ما لقيت هذي الرتبة.");
    if (!role || problem) {
        await interaction.editReply({ content: problem ?? L("I can't find that role.", "ما لقيت هذي الرتبة."), allowedMentions: { parse: [] } });
        return;
    }

    await ServerConfigRepository.setTagSetup(guild.id, role.id, logChannelId);
    await interaction.editReply({
        content: [
            L(`Members wearing the server tag of any of my servers now get ${role} here. I'm giving it to everyone who already wears one.`, `اللي يلبسون تاق أي سيرفر من سيرفراتي صاروا ياخذون ${role} هنا. جاري إعطاؤها لكل اللي لابسينه.`),
            logChannelId ? L(`Changes are logged in <#${logChannelId}>.`, `التغييرات تنسجل في <#${logChannelId}>.`) : L("No log channel: add `log:` to log each change.", "ما في روم لوق: أضف `log:` لتسجيل كل تغيير."),
        ].join("\n"),
        allowedMentions: { parse: [] },
    });

    void syncGuildTagRoles(guild, { roleId: role.id, logChannelId })
        .then(({ given, removed }) => Logger.info(`Tag role set in ${guild.id}: given to ${given}, removed from ${removed}`, "tag"))
        .catch(err => Logger.warn(`Tag role sync after setup failed in ${guild.id}: ${err}`, "tag"));
};
