/**
 * Turns a message body that uses embeds into the bot's house style (Components V2, Wolf Manager's layout): each embed
 * becomes a container with the server's colour down its side, the title in bold, the text, each field as a block,
 * the big image as a gallery, the footer as small text under a line, and the message's buttons inside the last
 * container. Pure: it reads and returns raw API JSON, so it can be tested without Discord.
 *
 * Returns null when the body can't become V2 without losing something (too many components or too much text for
 * one V2 message); the caller then sends the embeds as they were.
 */

/** Discord component types. */
const T = { row: 1, section: 9, text: 10, thumbnail: 11, gallery: 12, separator: 14, container: 17 } as const;

export const IS_COMPONENTS_V2 = 1 << 15;
const MAX_COMPONENTS = 40;
const MAX_TEXT = 4000;

interface EmbedJSON {
    title?: string;
    url?: string;
    description?: string;
    color?: number;
    timestamp?: string;
    author?: { name?: string; url?: string };
    footer?: { text?: string };
    thumbnail?: { url?: string };
    image?: { url?: string };
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
}

type Json = Record<string, unknown>;

export interface BodyJSON {
    content?: string | null;
    embeds?: EmbedJSON[] | null;
    components?: object[] | null;
    flags?: number | bigint | null;
    allowed_mentions?: { parse?: string[]; users?: string[]; roles?: string[]; replied_user?: boolean } | null;
    [key: string]: unknown;
}

const text = (content: string): Json => ({ type: T.text, content });
const line = (): Json => ({ type: T.separator, divider: true, spacing: 1 });

/** Counts a component and everything inside it, the way Discord's 40-component limit does. */
function count(c: Json): number {
    const inner = [...((c.components as Json[] | undefined) ?? []), ...(c.accessory ? [c.accessory as Json] : [])];
    return 1 + inner.reduce((n, x) => n + count(x), 0);
}

function textLength(c: Json): number {
    const own = c.type === T.text ? String(c.content ?? "").length : 0;
    const inner = [...((c.components as Json[] | undefined) ?? []), ...(c.accessory ? [c.accessory as Json] : [])];
    return own + inner.reduce((n, x) => n + textLength(x), 0);
}

function embedToContainer(e: EmbedJSON, accent: number): Json {
    const parts: Json[] = [];

    const head: string[] = [];
    if (e.author?.name) head.push(`-# ${e.author.url ? `[${e.author.name}](${e.author.url})` : e.author.name}`);
    if (e.title) head.push(`**${e.url ? `[${e.title}](${e.url})` : e.title}**`);
    if (e.description) head.push(e.description);
    const headText = head.join("\n");

    if (e.thumbnail?.url && headText) {
        parts.push({ type: T.section, components: [text(headText)], accessory: { type: T.thumbnail, media: { url: e.thumbnail.url } } });
    } else if (headText) {
        parts.push(text(headText));
    }

    // Fields one block each, under a thin line, like the rows on /top and /roles. Neighbouring inline fields share a
    // block (V2 has no columns), so a row of three short stats doesn't become three lines of separators.
    const fields = e.fields ?? [];
    for (let i = 0; i < fields.length; i++) {
        const group = [fields[i]!];
        while (fields[i]!.inline && fields[i + 1]?.inline && group.length < 3) group.push(fields[++i]!);
        if (parts.length) parts.push(line());
        parts.push(text(group.map(f => `**${f.name}**\n${f.value}`).join("\n")));
    }

    if (e.image?.url) parts.push({ type: T.gallery, items: [{ media: { url: e.image.url } }] });

    const footer = [e.footer?.text, e.timestamp ? `<t:${Math.floor(Date.parse(e.timestamp) / 1000)}:f>` : null].filter(Boolean).join(" • ");
    if (footer) {
        if (parts.length) parts.push(line());
        parts.push(text(`-# ${footer}`));
    }
    if (!parts.length) parts.push(text("​"));

    return { type: T.container, accent_color: accent, components: parts };
}

const MENTION = /<@!?(\d{15,22})>|<@&(\d{15,22})>/g;

/**
 * V2 text pings whatever it mentions; an embed never did. So only what the plain content mentioned may still ping,
 * under the rules the message already had.
 */
function mentionsFromContent(content: string, allowed: BodyJSON["allowed_mentions"]): NonNullable<BodyJSON["allowed_mentions"]> {
    const users = new Set<string>(), roles = new Set<string>();
    for (const m of content.matchAll(MENTION)) (m[1] ? users : roles).add(m[1] ?? m[2]!);
    const parse = allowed?.parse ?? ["users", "roles", "everyone"];
    const okUser = (id: string) => parse.includes("users") || (allowed?.users ?? []).includes(id);
    const okRole = (id: string) => parse.includes("roles") || (allowed?.roles ?? []).includes(id);
    return {
        parse: parse.includes("everyone") && /@(everyone|here)/.test(content) ? ["everyone"] : [],
        users: [...users].filter(okUser),
        roles: [...roles].filter(okRole),
        ...(allowed?.replied_user !== undefined ? { replied_user: allowed.replied_user } : {}),
    };
}

/** Embeds → containers; null when it wouldn't fit. Bodies without embeds are returned unchanged. */
export function embedsToV2(body: BodyJSON, accent: number): BodyJSON | null {
    const embeds = body.embeds ?? [];
    if (!embeds.length) return body;

    const top: Json[] = [];
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (content) top.push(text(content));

    const containers = embeds.map(e => embedToContainer(e, accent));
    // The message's buttons and menus go inside the last container, as on /top and /roles.
    const rows = (body.components ?? []) as Json[];
    if (rows.length) {
        const last = containers[containers.length - 1]!;
        (last.components as Json[]).push(line(), ...rows);
    }
    top.push(...containers);

    if (top.reduce((n, c) => n + count(c), 0) > MAX_COMPONENTS) return null;
    if (top.reduce((n, c) => n + textLength(c), 0) > MAX_TEXT) return null;

    return {
        ...body,
        content: undefined,
        embeds: undefined,
        components: top,
        flags: Number(body.flags ?? 0) | IS_COMPONENTS_V2,
        allowed_mentions: mentionsFromContent(content, body.allowed_mentions),
    };
}

/**
 * A plain-text body sent to (or edited into) a message that is already V2: content isn't allowed there, so it
 * becomes a container too. Components-only bodies pass through.
 */
export function contentToV2(body: BodyJSON, accent: number): BodyJSON {
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!content || (body.embeds?.length ?? 0) > 0) return body;
    const rows = (body.components ?? []) as Json[];
    // Already V2 components (a container, text…): the text goes above them rather than wrapping them.
    const components = rows.some(r => r.type !== T.row)
        ? [text(content), ...rows]
        : [{ type: T.container, accent_color: accent, components: [text(content), ...(rows.length ? [line(), ...rows] : [])] }];
    return {
        ...body,
        content: undefined,
        components,
        flags: Number(body.flags ?? 0) | IS_COMPONENTS_V2,
        allowed_mentions: mentionsFromContent(content, body.allowed_mentions),
    };
}
