import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    LabelBuilder,
    MessageFlags,
    ModalBuilder,
    SeparatorSpacingSize,
    StringSelectMenuBuilder,
    TextInputBuilder,
    TextInputStyle,
    escapeMarkdown,
    type Guild,
} from "discord.js";
import { randomBytes } from "node:crypto";
import { TOP_DEFAULT_ACCENT } from "@constants";
import { buttonEmoji, emoji } from "@config";
import { getStaffRoles } from "@core/staff-api";
import { ServerConfigRepository } from "@database/repositories";
import type { Lang } from "@typings/lang";
import { t } from "@bot/utils/lang";
import {
    ROLE_KINDS,
    applyRoleFilter,
    classifyRole,
    clampPage,
    describeFilter,
    kindLabel,
    pageCount,
    pageRows,
    roleBlock,
    type RoleFilter,
    type RoleKind,
    type RoleRow,
} from "./roles-view";

/**
 * The `?roles` panel, in Wolf Manager's layout: a coloured container with a header line, then each role (name, ID,
 * mention, members, staff type and level) between thin lines, and the buttons at the bottom. Its state (the loaded
 * roles, the filter, the page) lives in memory for `SESSION_TTL_MS`, keyed by a short id carried in every button and
 * modal id: a Discord custom id is only 100 characters, too small for the filter itself. Only whoever opened the
 * panel can use it.
 */

const SESSION_TTL_MS = 15 * 60_000;
const COLOR = /^#[0-9a-f]{6}$/i;

export interface RolesSession {
    id: string;
    invokerId: string;
    guildName: string;
    lang: Lang;
    /** The bar down the side: the server's `/top` accent. */
    accent: number;
    rows: RoleRow[];
    staffApiDown: boolean;
    filter: RoleFilter;
    page: number;
    expiresAt: number;
}

const sessions = new Map<string, RolesSession>();

export const ROLES_BUTTON_ID = /^roles:[a-f0-9]{8}:(prev|next|search|filter|reset)$/;
export const ROLES_SEARCH_MODAL_ID = /^roles-search:[a-f0-9]{8}$/;
export const ROLES_FILTER_MODAL_ID = /^roles-filter:[a-f0-9]{8}$/;

export const ROLES_FIELDS = {
    query: "roles-query",
    kinds: "roles-kinds",
    orderMin: "roles-order-min",
    orderMax: "roles-order-max",
    minMembers: "roles-min-members",
    sort: "roles-sort",
} as const;

export function getRolesSession(id: string): RolesSession | null {
    const session = sessions.get(id);
    if (!session) return null;
    if (session.expiresAt < Date.now()) {
        sessions.delete(id);
        return null;
    }
    session.expiresAt = Date.now() + SESSION_TTL_MS;
    return session;
}

/**
 * Loads every role once per panel: member counts from Discord (all members fetched once), staff
 * type and order from the staff API. If the API is down, roles still list — without staff info.
 */
export async function openRolesSession(guild: Guild, invokerId: string, lang: Lang = "en"): Promise<RolesSession> {
    const [roles, , config] = await Promise.all([
        guild.roles.fetch(),
        guild.members.fetch().catch(() => null),
        ServerConfigRepository.find(guild.id).catch(() => null),
    ]);
    const list = [...roles.values()].filter(role => role.id !== guild.id);
    const staff = await getStaffRoles(guild.id, list.map(role => role.id));

    const rows: RoleRow[] = list.map(role => ({
        id: role.id,
        name: role.name,
        position: role.position,
        members: role.members.size,
        ...classifyRole(
            { id: role.id, managed: role.managed, isBoosterRole: Boolean(role.tags?.premiumSubscriberRole) },
            staff?.get(role.id),
        ),
    }));

    for (const [id, s] of sessions) if (s.expiresAt < Date.now()) sessions.delete(id);

    const accent = config?.topStyle?.accent;
    const session: RolesSession = {
        id: randomBytes(4).toString("hex"),
        invokerId,
        guildName: guild.name,
        lang,
        accent: parseInt((typeof accent === "string" && COLOR.test(accent) ? accent : TOP_DEFAULT_ACCENT).slice(1), 16),
        rows,
        staffApiDown: staff === null,
        filter: {},
        page: 0,
        expiresAt: Date.now() + SESSION_TTL_MS,
    };
    sessions.set(session.id, session);
    return session;
}

/** The panel message for the session's current filter and page. */
export function renderRolesPanel(session: RolesSession) {
    const { lang } = session;
    const rows = applyRoleFilter(session.rows, session.filter);
    session.page = clampPage(session.page, rows.length);
    const pages = pageCount(rows.length);
    const filtered = describeFilter(session.filter);

    const container = new ContainerBuilder().setAccentColor(session.accent);
    container.addTextDisplayComponents(d => d.setContent(`**${t("roles.header", lang, {
        guild: escapeMarkdown(session.guildName),
        total: `${rows.length}`,
        page: `${session.page + 1}`,
        pages: `${pages}`,
    })}**`));
    const notes = [
        ...(filtered ? [`-# ${filtered}`] : []),
        ...(session.staffApiDown ? [`-# ⚠️ ${t("roles.staff_down", lang)}`] : []),
    ];
    if (notes.length) container.addTextDisplayComponents(d => d.setContent(notes.join("\n")));

    const onPage = pageRows(rows, session.page);
    if (!onPage.length) container.addTextDisplayComponents(d => d.setContent(t("roles.none_match", lang)));
    for (const row of onPage) {
        container.addSeparatorComponents(s => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        container.addTextDisplayComponents(d => d.setContent(roleBlock(row, lang)));
    }

    const id = (action: string) => `roles:${session.id}:${action}`;
    const withEmoji = (button: ButtonBuilder, value: string, fallback: string) => {
        const icon = buttonEmoji(value);
        return icon ? button.setEmoji(icon) : button.setLabel(fallback);
    };
    const labelled = (button: ButtonBuilder, value: string, label: string) => {
        const icon = buttonEmoji(value);
        return (icon ? button.setEmoji(icon) : button).setLabel(label);
    };
    container.addSeparatorComponents(s => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    container.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
        withEmoji(new ButtonBuilder().setCustomId(id("prev")).setStyle(ButtonStyle.Secondary).setDisabled(session.page === 0), emoji("top_prev"), "<"),
        withEmoji(new ButtonBuilder().setCustomId(id("next")).setStyle(ButtonStyle.Secondary).setDisabled(session.page >= pages - 1), emoji("top_next"), ">"),
        labelled(new ButtonBuilder().setCustomId(id("search")).setStyle(ButtonStyle.Secondary), emoji("roles_search"), t("roles.search", lang)),
        labelled(new ButtonBuilder().setCustomId(id("filter")).setStyle(ButtonStyle.Secondary), emoji("roles_filter"), t("roles.filter", lang)),
        new ButtonBuilder().setCustomId(id("reset")).setLabel(t("roles.reset", lang)).setStyle(ButtonStyle.Danger).setDisabled(!filtered),
    ));

    // Text in a V2 message pings what it mentions; the list mentions every role, so nothing may notify.
    return { components: [container], flags: MessageFlags.IsComponentsV2 as const, allowedMentions: { parse: [] as never[] } };
}

export function buildRolesSearchModal(session: RolesSession): ModalBuilder {
    const { lang } = session;
    return new ModalBuilder()
        .setCustomId(`roles-search:${session.id}`)
        .setTitle(t("roles.search_title", lang))
        .addLabelComponents(
            new LabelBuilder()
                .setLabel(t("roles.search_label", lang))
                .setDescription(t("roles.search_hint", lang))
                .setTextInputComponent(new TextInputBuilder()
                    .setCustomId(ROLES_FIELDS.query)
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
                    .setMaxLength(100)
                    .setValue(session.filter.query ?? "")),
        );
}

/** The filter form. Every field is optional; it opens filled with the current filter. */
export function buildRolesFilterModal(session: RolesSession): ModalBuilder {
    const { filter, lang } = session;
    const kindOptions: Array<{ label: string; value: RoleKind | "anyStaff" }> = [
        { label: t("roles.any_staff", lang), value: "anyStaff" },
        ...ROLE_KINDS.map(value => ({ label: kindLabel(value, lang), value })),
    ];
    const text = (id: string, label: string, value: number | undefined, placeholder: string) => new LabelBuilder()
        .setLabel(label)
        .setTextInputComponent(new TextInputBuilder()
            .setCustomId(id)
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(6)
            .setPlaceholder(placeholder)
            .setValue(value !== undefined ? String(value) : ""));

    return new ModalBuilder()
        .setCustomId(`roles-filter:${session.id}`)
        .setTitle(t("roles.filter_title", lang))
        .addLabelComponents(
            new LabelBuilder()
                .setLabel(t("roles.type", lang))
                .setDescription(t("roles.type_hint", lang))
                .setStringSelectMenuComponent(new StringSelectMenuBuilder()
                    .setCustomId(ROLES_FIELDS.kinds)
                    .setRequired(false)
                    .setMinValues(0)
                    .setMaxValues(kindOptions.length)
                    .addOptions(kindOptions.map(o => ({ ...o, default: filter.kinds?.includes(o.value) ?? false })))),
            text(ROLES_FIELDS.orderMin, t("roles.level_from", lang), filter.orderMin, "1"),
            text(ROLES_FIELDS.orderMax, t("roles.level_to", lang), filter.orderMax, "10"),
            text(ROLES_FIELDS.minMembers, t("roles.min_members", lang), filter.minMembers, "5"),
            new LabelBuilder()
                .setLabel(t("roles.sort", lang))
                .setStringSelectMenuComponent(new StringSelectMenuBuilder()
                    .setCustomId(ROLES_FIELDS.sort)
                    .setRequired(false)
                    .setMinValues(0)
                    .setMaxValues(1)
                    .addOptions(
                        { label: t("roles.sort_position", lang), value: "position", default: (filter.sort ?? "position") === "position" },
                        { label: t("roles.sort_order", lang), value: "order", default: filter.sort === "order" },
                        { label: t("roles.sort_members", lang), value: "members", default: filter.sort === "members" },
                    )),
        );
}
