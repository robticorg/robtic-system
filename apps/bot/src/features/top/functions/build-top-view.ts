import {
    ActionRowBuilder,
    AttachmentBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    EmbedBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags,
    SeparatorSpacingSize,
    type Guild,
} from "discord.js";
import {
    TOP_ALL_CATEGORIES,
    TOP_DEFAULT_ACCENT,
    TOP_DETAIL_LIMIT,
    TOP_DISPLAY_LIMIT,
    TOP_OVERVIEW_BOARDS,
    type ComboLeaderboardPeriod,
    type TopCategory,
} from "@constants";
import { buttonEmoji, emoji } from "@config";
import { BranchAssetRepository, ServerConfigRepository } from "@database/repositories";
import type { Lang } from "@typings/lang";
import { t } from "@bot/utils/lang";
import { formatVoiceDuration } from "@bot/features/voice/utils/format-duration";
import { buildRankRows, type RankRows } from "../utils/rank-lines";
import { getActivitySeries } from "../chart/activity-series";
import { renderActivityChart } from "../chart/render-activity-chart";

/** `all` on the overview, a category name on a single board. */
export type TopScope = TopCategory | typeof TOP_ALL_CATEGORIES;

const CHART_FILE = "top-activity.png";
const COLOR = /^#[0-9a-f]{6}$/i;

export interface TopView {
    /** A Components container (with its buttons inside), or only the button row under an embed. */
    components: (ContainerBuilder | ActionRowBuilder<ButtonBuilder>)[];
    embeds?: EmbedBuilder[];
    files: AttachmentBuilder[];
    flags?: MessageFlags.IsComponentsV2;
    /** Every mention is shown, none notified. */
    allowedMentions: { parse: [] };
}

const BUTTON_STYLES = { secondary: ButtonStyle.Secondary, primary: ButtonStyle.Primary, success: ButtonStyle.Success, danger: ButtonStyle.Danger } as const;

interface TopStyle {
    accent: string;
    chart: boolean;
    /** Dashboard → Leaderboards: a Components container (default) or an embed. */
    format: "components" | "embed";
    buttons: ButtonStyle;
}

async function topStyle(guildId: string): Promise<TopStyle> {
    const config = await ServerConfigRepository.find(guildId).catch(() => null);
    const style = config?.topStyle ?? {};
    return {
        accent: typeof style.accent === "string" && COLOR.test(style.accent) ? style.accent : TOP_DEFAULT_ACCENT,
        chart: style.chart !== false,
        format: style.format === "embed" ? "embed" : "components",
        buttons: BUTTON_STYLES[style.buttons as keyof typeof BUTTON_STYLES] ?? ButtonStyle.Secondary,
    };
}

/** `Messages: **2051**`, `Time: **15h 29m**`. */
function valueText(category: TopCategory, value: number, lang: Lang): string {
    const shown = category === "voice" ? formatVoiceDuration(value) : value.toLocaleString("en-US");
    return `${t(`top.label_${category}`, lang)}: **${shown}**`;
}

/** One board: its title, then a row per rank with a thin line between. */
function addBoard(container: ContainerBuilder, lines: string[], category: TopCategory, period: ComboLeaderboardPeriod, ranks: RankRows, lang: Lang): void {
    const icon = category === "messages" ? emoji("top_text") : category === "voice" ? emoji("top_voice") : emoji("top_board");
    const title = t(`top.board_${category}`, lang);
    const head = `${icon} **${title}** · ${t(`top.when_${period}`, lang)}`;
    container.addTextDisplayComponents(d => d.setContent(head));
    lines.push(head);

    if (!ranks.rows.length) {
        container.addTextDisplayComponents(d => d.setContent(`-# ${t("top.no_entries", lang)}`));
        lines.push(`-# ${t("top.no_entries", lang)}`);
        return;
    }
    for (const row of ranks.rows) {
        const line = `${emoji("top_rank")} ${row.rank} | <@${row.entry.discordId}> — ${valueText(category, row.entry.value, lang)}`;
        container.addSeparatorComponents(s => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        container.addTextDisplayComponents(d => d.setContent(line));
        lines.push(line);
    }
}

/** Chart titles and labels per period. */
function chartText(period: ComboLeaderboardPeriod, lang: Lang) {
    return {
        title: t(`top.chart_title_${period}`, lang),
        totalLabel: t("top.chart_total", lang),
        changeLabel: period === "alltime" ? null : t(`top.chart_change_${period}`, lang),
        rtl: lang === "ar",
    };
}

/**
 * The whole `/top` message: a coloured container holding the board(s), the page line, the server's activity chart and
 * the page buttons. The overview holds the text and voice boards, five ranks each, paged together; a named board holds
 * ten ranks a page.
 */
export async function buildTopView(
    guild: Guild,
    scope: TopScope,
    period: ComboLeaderboardPeriod,
    lang: Lang,
    viewer: { id: string; name: string },
    page: number,
): Promise<TopView> {
    const boards: readonly TopCategory[] = scope === TOP_ALL_CATEGORIES ? TOP_OVERVIEW_BOARDS : [scope];
    const pageSize = scope === TOP_ALL_CATEGORIES ? TOP_DISPLAY_LIMIT : TOP_DETAIL_LIMIT;

    // The page count comes from the longest board, so a first look decides it; the page itself is clamped to it.
    const firstLook = await Promise.all(boards.map(c => buildRankRows(guild.id, c, period, { page: 0, pageSize, viewerId: viewer.id })));
    const pages = Math.max(1, Math.ceil(Math.max(...firstLook.map(r => r.ranked)) / pageSize));
    const index = Math.min(Math.max(0, page), pages - 1);
    const ranks = index === 0
        ? firstLook
        : await Promise.all(boards.map(c => buildRankRows(guild.id, c, period, { page: index, pageSize, viewerId: viewer.id })));

    const style = await topStyle(guild.id);
    const container = new ContainerBuilder().setAccentColor(parseInt(style.accent.slice(1), 16));
    const lines: string[] = [];

    boards.forEach((category, i) => {
        if (i > 0) { container.addSeparatorComponents(s => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small)); lines.push(""); }
        addBoard(container, lines, category, period, ranks[i]!, lang);
    });

    const footer = t("top.footer", lang, { page: `${index + 1}`, pages: `${pages}`, user: viewer.name });
    container.addSeparatorComponents(s => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    container.addTextDisplayComponents(d => d.setContent(`-# ${footer} • <t:${Math.floor(Date.now() / 1000)}:f>`));
    let chart = false;

    const files: AttachmentBuilder[] = [];
    if (style.chart) {
        const [series, background] = await Promise.all([
            getActivitySeries(guild.id, period),
            BranchAssetRepository.get(`top-bg:${guild.id}`).catch(() => null),
        ]);
        const png = await renderActivityChart(series, chartText(period, lang), style.accent, background?.data ?? null).catch(() => null);
        if (png) {
            files.push(new AttachmentBuilder(png, { name: CHART_FILE }));
            chart = true;
            container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(`attachment://${CHART_FILE}`)));
        }
    }

    const nav = (target: number, label: string, slot: "top_prev" | "top_next", disabled: boolean) => {
        const button = new ButtonBuilder()
            .setCustomId(`top:nav:${viewer.id}:${scope}:${target}:${period}:${slot === "top_prev" ? "p" : "n"}`)
            .setStyle(style.buttons)
            .setDisabled(disabled);
        const icon = buttonEmoji(emoji(slot));
        return icon ? button.setEmoji(icon) : button.setLabel(label);
    };
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        nav(Math.max(0, index - 1), "<", "top_prev", index <= 0),
        nav(Math.min(pages - 1, index + 1), ">", "top_next", index >= pages - 1),
    );

    if (style.format === "embed") {
        const embed = new EmbedBuilder()
            .setColor(parseInt(style.accent.slice(1), 16))
            .setDescription(lines.join("\n").slice(0, 4096))
            .setFooter({ text: footer })
            .setTimestamp();
        if (chart) embed.setImage(`attachment://${CHART_FILE}`);
        return { embeds: [embed], components: [row], files, allowedMentions: { parse: [] } };
    }
    container.addActionRowComponents(row);
    return { components: [container], files, flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
}
