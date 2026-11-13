import { EmbedBuilder } from "discord.js";
import type { IShortcutDoc } from "@database/models";
import { COLORS, SHORTCUT_DELETE_MODE_SHORT, type ShortcutDeleteMode } from "@constants";
import { CHAT_UTIL_COMMANDS } from "../functions/run-chat-util";

import { L } from "@utils";
export const targetLabel = (command: string): string =>
    CHAT_UTIL_COMMANDS.has(command) ? `/chat ${command}` : `/${command}`;

/** One line per shortcut for `/shortcut list`. */
export function buildShortcutListEmbed(shortcuts: IShortcutDoc[]): EmbedBuilder {
    const lines = shortcuts.map(s => {
        const mode = SHORTCUT_DELETE_MODE_SHORT[s.deleteMode as ShortcutDeleteMode];
        const restricted = s.allowedRoleIds.length || s.channelIds.length ? " 🔒" : "";
        const off = s.enabled ? "" : " ⏸️";
        return `• \`${s.trigger}\` → \`${targetLabel(s.command)}\`${s.argsTemplate ? ` \`${s.argsTemplate}\`` : ""} · ${mode}${restricted}${off}`;
    });

    return new EmbedBuilder()
        .setTitle(L("Shortcuts", "الاختصارات"))
        .setColor(COLORS.info)
        .setDescription(lines.join("\n") || L("No shortcuts yet.", "ما في اختصارات لين الحين."))
        .setFooter({ text: L("🔒 restricted · ⏸️ off · /shortcut info <trigger> for more", "🔒 مقيد · ⏸️ مقفل · /shortcut info <الاختصار> للتفاصيل") });
}

/** Everything about one shortcut, including its restrictions and usage. */
export function buildShortcutInfoEmbed(shortcut: IShortcutDoc): EmbedBuilder {
    const list = (ids: string[], mention: (id: string) => string, empty: string) =>
        ids.length ? ids.map(mention).join(", ") : empty;

    return new EmbedBuilder()
        .setTitle(L(`Shortcut: ${shortcut.trigger}`, `الاختصار: ${shortcut.trigger}`))
        .setColor(shortcut.enabled ? COLORS.info : COLORS.warning)
        .addFields(
            { name: L("Runs", "يشغل"), value: `\`${targetLabel(shortcut.command)}\``, inline: true },
            { name: L("Status", "الحالة"), value: shortcut.enabled ? L("On", "مفعّل") : L("Off", "مقفل"), inline: true },
            { name: L("Cleanup", "التنظيف"), value: SHORTCUT_DELETE_MODE_SHORT[shortcut.deleteMode as ShortcutDeleteMode], inline: true },
            {
                name: L("Fixed arguments", "قيم ثابتة"),
                value: shortcut.argsTemplate ? `\`${shortcut.argsTemplate}\`` : L("None: what the member types is passed on as it is", "لا يوجد: اللي يكتبه العضو ينرسل مثل ما هو"),
            },
            { name: L("Allowed roles", "الرتب المسموحة"), value: list(shortcut.allowedRoleIds, id => `<@&${id}>`, L("Anyone who can run the command", "أي أحد يقدر يشغل الأمر")) },
            { name: L("Channels", "الرومات"), value: list(shortcut.channelIds, id => `<#${id}>`, L("Every channel", "كل الرومات")) },
            {
                name: L("Used", "الاستخدام"),
                value: shortcut.uses > 0
                    ? L(`${shortcut.uses} time(s), last <t:${Math.floor((shortcut.lastUsedAt ?? shortcut.createdAt).getTime() / 1000)}:R>`, `${shortcut.uses} مرة، آخرها <t:${Math.floor((shortcut.lastUsedAt ?? shortcut.createdAt).getTime() / 1000)}:R>`)
                    : L("Never", "ولا مرة"),
            },
        );
}
