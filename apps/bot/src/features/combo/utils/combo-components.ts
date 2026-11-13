import {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    type GuildMember,
} from "discord.js";
import { COMBO_LEADERBOARD_PERIODS, SUPER_ADMIN_ID, type ComboLeaderboardPeriod, type ComboLeaderboardType } from "@constants";
import { SuperUserRepository } from "@database/repositories";
import { isManager } from "@bot/utils/access";

import { L } from "@utils";
import { LEADERBOARD_PERIOD_LABELS, LEADERBOARD_TYPE_LABELS } from "./combo-embeds";
export type ComboPage = "status" | "statistics" | "history" | "leaderboards" | "records" | "settings";

/** The same labels the leaderboard embed uses, in the server's language. */
const PERIOD_LABELS = LEADERBOARD_PERIOD_LABELS;
const TYPE_LABELS = LEADERBOARD_TYPE_LABELS;

const COMBO_LEADERBOARD_TYPES: ComboLeaderboardType[] = ["combo", "streak", "partner"];

/** Mirrors checkPermissions()'s bypass order in interaction-helper.ts (super admin, then whitelist, then role-based level) so combo Settings isn't gated more strictly than every other admin surface in this bot. */
export async function isComboAdmin(userId: string, member: GuildMember | null): Promise<boolean> {
    if (userId === SUPER_ADMIN_ID) return true;
    if (await SuperUserRepository.isWhitelisted(userId)) return true;
    return member ? isManager(member) : false;
}

/** Only the invoking user may operate their own /combo message's components. */
export { verifyInvoker } from "@bot/utils/interaction/verify-invoker";

export function buildComboNavRow(invokerId: string, isAdmin: boolean): ActionRowBuilder<StringSelectMenuBuilder> {
    const options: { label: string; description: string; value: ComboPage; emoji: string }[] = [
        { label: L("Status", "الحالة"), description: L("Your combo right now", "حالة الكومبو الحالية الخاصة بك"), value: "status", emoji: "🔥" },
        { label: L("Stats", "الإحصائيات"), description: L("Your combo in detail", "إحصائيات مفصلة عن الكومبو"), value: "statistics", emoji: "📊" },
        { label: L("History", "السجل"), description: L("Your past combos", "الكومبوهات السابقة الخاصة بك"), value: "history", emoji: "📜" },
        { label: L("Leaderboards", "لوحة المتصدرين"), description: L("The server's combo leaderboards", "لوحات متصدري الكومبو في السيرفر"), value: "leaderboards", emoji: "🏆" },
        { label: L("Records", "الأرقام القياسية"), description: L("The server's all-time records", "الأرقام القياسية للسيرفر منذ البداية"), value: "records", emoji: "🏛️" },
    ];

    if (isAdmin) {
        options.push({ label: L("Settings", "الإعدادات"), description: L("Champion role (staff)", "إعداد رتبة البطل (للمشرفين)"), value: "settings", emoji: "⚙️" });
    }

    const menu = new StringSelectMenuBuilder()
        .setCustomId(`combo:nav:${invokerId}`)
        .setPlaceholder(L("Go to…", "التنقل..."))
        .addOptions(options);

    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

export function buildComboLeaderboardRows(
    invokerId: string,
    period: ComboLeaderboardPeriod,
    type: ComboLeaderboardType,
): ActionRowBuilder<StringSelectMenuBuilder>[] {
    const periodMenu = new StringSelectMenuBuilder()
        .setCustomId(`combo:lb-period:${invokerId}:${type}`)
        .setPlaceholder(L("Period", "الفترة"))
        .addOptions(COMBO_LEADERBOARD_PERIODS.map(p => ({ label: PERIOD_LABELS[p], value: p, default: p === period })));

    const typeMenu = new StringSelectMenuBuilder()
        .setCustomId(`combo:lb-type:${invokerId}:${period}`)
        .setPlaceholder(L("Leaderboard", "نوع لوحة المتصدرين"))
        .addOptions(COMBO_LEADERBOARD_TYPES.map(t => ({ label: TYPE_LABELS[t], value: t, default: t === type })));

    return [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(periodMenu),
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(typeMenu),
    ];
}

export function buildComboSettingsRow(invokerId: string): ActionRowBuilder<RoleSelectMenuBuilder> {
    const roleSelect = new RoleSelectMenuBuilder()
        .setCustomId(`combo:settings-role:${invokerId}`)
        .setPlaceholder(L("Pick the champion role…", "اختر رتبة البطل..."))
        .setMinValues(0)
        .setMaxValues(1);

    return new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleSelect);
}

export function buildComboPointsButtonRow(invokerId: string): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`combo:settings-points-open:${invokerId}`)
            .setLabel(L("Change combo points", "تعديل نقاط الكومبو"))
            .setEmoji("🎯")
            .setStyle(ButtonStyle.Secondary),
    );
}
