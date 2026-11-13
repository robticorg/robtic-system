import { EmbedBuilder, MessageFlags, type ButtonInteraction } from "discord.js";
import type { ComponentHandler } from "@typings/command";
import { StreakRepository } from "@database/repositories";
import { COLORS } from "@constants";
import { applyStreakRole } from "../utils/streak-role";

import { L } from "@utils";
export const streakSyncConfirmHandler: ComponentHandler<ButtonInteraction> = {
    customId: /^streak-sync-(confirm|cancel)_(\d+)(?:_(\d+))?$/,

    async run(interaction: ButtonInteraction) {
        const match = /^streak-sync-(confirm|cancel)_(\d+)(?:_(\d+))?$/.exec(interaction.customId);
        const [, action, initiatorId, sourceGuildId] = match ?? [];

        if (interaction.user.id !== initiatorId) {
            await interaction.reply({ content: L("This button isn't yours.", "هذا الزر مو لك."), flags: MessageFlags.Ephemeral });
            return;
        }

        if (action === "cancel") {
            await interaction.update({ content: L("Sync cancelled.", "تم إلغاء المزامنة."), embeds: [], components: [] });
            return;
        }

        await interaction.update({ content: L("⏳ Syncing…", "⏳ جاري المزامنة..."), embeds: [], components: [] });

        const destGuild = interaction.guild;
        if (!destGuild || !sourceGuildId) {
            await interaction.editReply({ content: L("Something went wrong while syncing.", "صار خطأ أثناء المزامنة.") });
            return;
        }

        const synced = await StreakRepository.bulkSyncFromGuild(sourceGuildId, destGuild.id);

        let rolesApplied = 0;
        for (const record of synced) {
            const member = await destGuild.members.fetch(record.discordId).catch(() => null);
            if (!member) continue;
            await applyStreakRole(member, record.currentStreak).catch(() => null);
            rolesApplied++;
        }

        await interaction.editReply({
            content: "",
            embeds: [new EmbedBuilder()
                .setTitle(L("✅ Synced", "✅ تمت المزامنة"))
                .setColor(COLORS.success)
                .setDescription(L(`Synced **${synced.length}** streaks and updated roles for **${rolesApplied}** members here.`, `تمت مزامنة **${synced.length}** ستريك وتحديث الرتب لـ **${rolesApplied}** عضو هنا.`))],
        });
    },
};
