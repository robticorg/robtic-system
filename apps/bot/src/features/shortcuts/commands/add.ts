import { EmbedBuilder } from "discord.js";
import type { FeatureSubcommandHandler } from "@typings/feature";
import { COLORS, SHORTCUT_DELETE_MODE_LABELS, isShortcutDeleteMode, SHORTCUT_DELETE_MODES } from "@constants";
import { ShortcutRepository } from "@database/repositories";
import { isReachableTarget } from "../functions/report-orphan-shortcuts";
import { targetLabel } from "../utils/build-shortcut-embed";

import { L } from "@utils";
export const add: FeatureSubcommandHandler = async (interaction, client) => {
    const command = interaction.options.getString("command")?.trim().replace(/\s+/g, " ") ?? "";
    const trigger = interaction.options.getString("trigger")?.trim() ?? "";
    const argsTemplate = interaction.options.getString("args")?.trim() ?? "";
    const deleteMode = interaction.options.getString("delete") ?? "none";

    if (!command || !trigger) {
        await interaction.editReply({
            embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription(
                L("❌ That came through without ", "❌ وصل الطلب بدون ") + (!command ? "`command`" : "`trigger`") + ".\n" +
                L("Discord is showing an old copy of `/shortcut`: close it and pick the entry again, ", "ديسكورد يعرض نسخة قديمة من `/shortcut`: سكرها واختر من جديد، ") +
                L("or use the prefix form: `shortcut add \"points balance\" c`.", "أو استخدم الأمر الكتابي: `shortcut add \"points balance\" c`.")
            )],
        });
        return;
    }

    if (!isReachableTarget(client, command)) {
        await interaction.editReply({
            embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription(
                L(`❌ \`${command}\` is not a runnable command.\n`, `❌ \`${command}\` ليس أمر يشتغل.\n`) +
                L("Pick a suggestion from the list: commands with subcommands need the whole path, like `warn add`.", "اختر من الاقتراحات: الأوامر اللي فيها أوامر فرعية تحتاج المسار كامل، مثل `warn add`.")
            )],
        });
        return;
    }

    if (!isShortcutDeleteMode(deleteMode)) {
        await interaction.editReply({
            embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription(
                L(`❌ Unknown cleanup mode \`${deleteMode}\`. Use one of: ${SHORTCUT_DELETE_MODES.map(m => `\`${m}\``).join(", ")}.`, `❌ طريقة التنظيف \`${deleteMode}\` غير معروفة. استخدم: ${SHORTCUT_DELETE_MODES.map(m => `\`${m}\``).join("، ")}.`)
            )],
        });
        return;
    }

    if (!trigger) {
        await interaction.editReply({
            embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription(L("❌ The trigger can't be empty.", "❌ كلمة الاختصار ما تكون فاضية."))],
        });
        return;
    }

    await ShortcutRepository.upsert(interaction.guildId!, {
        trigger,
        command,
        argsTemplate,
        deleteMode,
        createdBy: interaction.user.id,
    });

    await interaction.editReply({
        embeds: [new EmbedBuilder()
            .setColor(COLORS.success)
            .setDescription(
                L(`Typing **${trigger}** now runs \`${targetLabel(command)}\``, `كتابة **${trigger}** صارت تشغل \`${targetLabel(command)}\``) +
                (argsTemplate ? L(` with \`${argsTemplate}\``, ` مع \`${argsTemplate}\``) : "") + ".\n" +
                L(`Afterwards: ${SHORTCUT_DELETE_MODE_LABELS[deleteMode].toLowerCase()}.`, `بعدها: ${SHORTCUT_DELETE_MODE_LABELS[deleteMode]}.`)
            )],
    });
};
