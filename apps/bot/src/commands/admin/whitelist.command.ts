import {
    SlashCommandBuilder,
    type ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
} from "discord.js";
import type { BotClient } from "@core/bot-client";
import { COLORS, SUPER_ADMIN_ID } from "@constants";
import { SuperUserRepository } from "@database/repositories";

import { L } from "@utils";
export default {
    category: "Admin",
    scope: "admin",
    data: new SlashCommandBuilder()
        .setName("whitelist")
        .setDescription("Manage the super user whitelist (bypasses all command permission checks)")
        .addSubcommand(sub =>
            sub.setName("add")
                .setDescription("Grant a user super user access")
                .addUserOption(opt =>
                    opt.setName("user").setDescription("The user to whitelist").setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName("remove")
                .setDescription("Revoke a user's super user access")
                .addUserOption(opt =>
                    opt.setName("user").setDescription("The user to remove").setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName("list")
                .setDescription("List all whitelisted super users")
        ),

    async run(interaction: ChatInputCommandInteraction, _client: BotClient) {
        if (interaction.user.id !== SUPER_ADMIN_ID) {
            await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setDescription(L("❌ You are not authorized to use this command.", "❌ ليس لديك صلاحية هذا الأمر."))
                    .setColor(COLORS.error)],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "add") {
            const user = interaction.options.getUser("user", true);
            await SuperUserRepository.add(user.id, interaction.user.id);

            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle(L("✅ Super user added", "✅ تمت إضافة مستخدم خارق"))
                    .setColor(COLORS.success)
                    .setDescription(L(`${user} (\`${user.id}\`) can now use any command in any server.`, `${user} (\`${user.id}\`) صار يقدر يستخدم أي أمر في أي سيرفر.`))],
            });
            return;
        }

        if (subcommand === "remove") {
            const user = interaction.options.getUser("user", true);
            await SuperUserRepository.remove(user.id);

            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle(L("✅ Super user removed", "✅ تم حذف المستخدم الخارق"))
                    .setColor(COLORS.success)
                    .setDescription(L(`${user} (\`${user.id}\`) no longer has super user access.`, `${user} (\`${user.id}\`) ما عاد عنده صلاحية المستخدم الخارق.`))],
            });
            return;
        }

        const superUsers = await SuperUserRepository.list();
        if (!superUsers.length) {
            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setDescription(L("No super users are whitelisted.", "ما في مستخدمين خارقين."))
                    .setColor(COLORS.info)],
            });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle(L("Super users", "المستخدمين الخارقين"))
            .setColor(COLORS.info)
            .setDescription(superUsers.map(u => L(`• <@${u.userId}> (\`${u.userId}\`) — added by <@${u.addedBy}>`, `• <@${u.userId}> (\`${u.userId}\`) — أضافه <@${u.addedBy}>`)).join("\n"));

        await interaction.editReply({ embeds: [embed] });
    },
};
