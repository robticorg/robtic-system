import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    LabelBuilder,
    ModalBuilder,
    StringSelectMenuBuilder,
    TextInputBuilder,
    TextInputStyle,
    type Guild,
} from "discord.js";
import { randomBytes } from "node:crypto";
import { COLORS } from "@constants";
import { getStaffRoles } from "@core/staff-api";
import {
    ROLE_KIND_LABELS,
    applyRoleFilter,
    classifyRole,
    clampPage,
    describeFilter,
    pageCount,
    pageLines,
    type RoleFilter,
    type RoleKind,
    type RoleRow,
} from "./roles-view";

/**
 * The `?roles` panel. Its state (the loaded roles, the filter, the page) lives in memory for
 * `SESSION_TTL_MS`, keyed by a short id carried in every button and modal id — a Discord custom id
 * is only 100 characters, too small for the filter itself. Only whoever opened the panel can use it.
 */

const SESSION_TTL_MS = 15 * 60_000;

export interface RolesSession {
    id: string;
    invokerId: string;
    guildName: string;
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
export async function openRolesSession(guild: Guild, invokerId: string): Promise<RolesSession> {
    const [roles] = await Promise.all([
        guild.roles.fetch(),
        guild.members.fetch().catch(() => null),
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

    const session: RolesSession = {
        id: randomBytes(4).toString("hex"),
        invokerId,
        guildName: guild.name,
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
    const rows = applyRoleFilter(session.rows, session.filter);
    session.page = clampPage(session.page, rows.length);
    const pages = pageCount(rows.length);
    const filtered = describeFilter(session.filter);

    const embed = new EmbedBuilder()
        .setTitle(`📋 ${session.guildName} roles`)
        .setColor(COLORS.info)
        .setDescription([
            ...(filtered ? [`-# ${filtered}`] : []),
            ...(session.staffApiDown ? ["-# ⚠️ Staff info unavailable right now — types and orders may be missing."] : []),
            rows.length ? pageLines(rows, session.page).join("\n") : "No roles match.",
        ].join("\n").slice(0, 4096))
        .setFooter({ text: `Page ${session.page + 1}/${pages} · ${rows.length}${rows.length !== session.rows.length ? ` of ${session.rows.length}` : ""} roles` });

    const id = (action: string) => `roles:${session.id}:${action}`;
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(id("prev")).setEmoji("◀️").setStyle(ButtonStyle.Secondary).setDisabled(session.page === 0),
        new ButtonBuilder().setCustomId(id("next")).setEmoji("▶️").setStyle(ButtonStyle.Secondary).setDisabled(session.page >= pages - 1),
        new ButtonBuilder().setCustomId(id("search")).setLabel("Search").setEmoji("🔍").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(id("filter")).setLabel("Filter").setEmoji("⚙️").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(id("reset")).setLabel("Reset").setStyle(ButtonStyle.Danger).setDisabled(!filtered),
    );

    return { embeds: [embed], components: [buttons] };
}

export function buildRolesSearchModal(session: RolesSession): ModalBuilder {
    return new ModalBuilder()
        .setCustomId(`roles-search:${session.id}`)
        .setTitle("Search roles")
        .addLabelComponents(
            new LabelBuilder()
                .setLabel("Role name or ID")
                .setDescription("Leave empty to clear the search")
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
    const { filter } = session;
    const kindOptions: Array<{ label: string; value: RoleKind | "anyStaff" }> = [
        { label: "Any staff", value: "anyStaff" },
        ...(Object.entries(ROLE_KIND_LABELS) as Array<[RoleKind, string]>).map(([value, label]) => ({ label, value })),
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
        .setTitle("Filter roles")
        .addLabelComponents(
            new LabelBuilder()
                .setLabel("Type")
                .setDescription("Pick any number — none means every type")
                .setStringSelectMenuComponent(new StringSelectMenuBuilder()
                    .setCustomId(ROLES_FIELDS.kinds)
                    .setRequired(false)
                    .setMinValues(0)
                    .setMaxValues(kindOptions.length)
                    .addOptions(kindOptions.map(o => ({ ...o, default: filter.kinds?.includes(o.value) ?? false })))),
            text(ROLES_FIELDS.orderMin, "Staff order from", filter.orderMin, "e.g. 1"),
            text(ROLES_FIELDS.orderMax, "Staff order to", filter.orderMax, "e.g. 10"),
            text(ROLES_FIELDS.minMembers, "At least this many members", filter.minMembers, "e.g. 5"),
            new LabelBuilder()
                .setLabel("Sort by")
                .setStringSelectMenuComponent(new StringSelectMenuBuilder()
                    .setCustomId(ROLES_FIELDS.sort)
                    .setRequired(false)
                    .setMinValues(0)
                    .setMaxValues(1)
                    .addOptions(
                        { label: "Server position (default)", value: "position", default: (filter.sort ?? "position") === "position" },
                        { label: "Staff order", value: "order", default: filter.sort === "order" },
                        { label: "Members", value: "members", default: filter.sort === "members" },
                    )),
        );
}
