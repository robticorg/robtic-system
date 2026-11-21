import { AttachmentBuilder, MessageFlags, type MessageCreateOptions, type MessageMentionOptions } from "discord.js";

/**
 * An announcement made in the dashboard's panel builder (Invites, Levels & XP → Embed or Components): its format,
 * blocks and embed. The dashboard keeps buttons and menus out, so only text, sections, galleries, separators and
 * containers come here. Uploaded pictures arrive as data URLs and are sent as attachments.
 */
interface Media { url: string; description?: string; spoiler?: boolean }
type Block =
    | { type: "text"; content: string }
    | { type: "section"; texts: string[]; accessory: { kind: "thumbnail"; media: Media } | { kind: "button"; button: { label?: string; url?: string; style?: string } } }
    | { type: "gallery"; items: Media[] }
    | { type: "separator"; divider: boolean; spacing: 1 | 2 }
    | { type: "container"; accent: string | null; spoiler: boolean; children: Block[] }
    | { type: string };

export interface AnnounceDesign {
    format: "embed" | "components";
    blocks?: Block[];
    embed?: { color?: string | null; author?: string; title?: string; url?: string; description?: string; fields?: { name: string; value: string; inline: boolean }[]; thumbnail?: string; image?: string; footer?: string };
}

const hex = (v: unknown) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? parseInt(v.slice(1), 16) : undefined);

class Files {
    readonly list: AttachmentBuilder[] = [];
    url(value: string): string {
        const m = /^data:image\/(png|jpe?g|gif|webp);base64,(.+)$/s.exec(value);
        if (!m) return value;
        const name = `image-${this.list.length + 1}.${m[1] === "jpeg" ? "jpg" : m[1]}`;
        this.list.push(new AttachmentBuilder(Buffer.from(m[2]!, "base64"), { name }));
        return `attachment://${name}`;
    }
}

function blocksJson(blocks: Block[], fill: (s: string) => string, files: Files): Record<string, unknown>[] {
    const media = (m: Media) => ({ media: { url: files.url(m.url) }, ...(m.description?.trim() ? { description: fill(m.description.trim()) } : {}), spoiler: Boolean(m.spoiler) });
    return blocks.flatMap((b): Record<string, unknown>[] => {
        switch (b.type) {
            case "text": { const t = fill((b as { content: string }).content).trim(); return t ? [{ type: 10, content: t }] : []; }
            case "section": {
                const s = b as Extract<Block, { type: "section" }>;
                const texts = s.texts.map(fill).filter(t => t.trim()).map(content => ({ type: 10, content }));
                if (!texts.length) return [];
                if (s.accessory.kind === "thumbnail" && s.accessory.media.url) return [{ type: 9, components: texts, accessory: { type: 11, ...media(s.accessory.media) } }];
                if (s.accessory.kind === "button" && s.accessory.button.url) return [{ type: 9, components: texts, accessory: { type: 2, style: 5, url: s.accessory.button.url, label: fill(s.accessory.button.label ?? "").trim() || "Open" } }];
                return texts;
            }
            case "gallery": { const items = (b as { items: Media[] }).items.filter(m => m.url).map(media); return items.length ? [{ type: 12, items }] : []; }
            case "separator": { const s = b as { divider: boolean; spacing: number }; return [{ type: 14, divider: s.divider, spacing: s.spacing }]; }
            case "container": {
                const c = b as Extract<Block, { type: "container" }>;
                const children = blocksJson(c.children, fill, files);
                return children.length ? [{ type: 17, ...(hex(c.accent) !== undefined ? { accent_color: hex(c.accent) } : {}), spoiler: c.spoiler, components: children }] : [];
            }
            default: return [];
        }
    });
}

/** The message for a builder-made announcement, its variables filled by `fill`. `null` when there's nothing to send. */
export function designPayload(design: AnnounceDesign, fill: (s: string) => string, allowedMentions: MessageMentionOptions = { parse: [] }): MessageCreateOptions | null {
    const files = new Files();
    if (design.format === "components") {
        const components = blocksJson(design.blocks ?? [], fill, files);
        if (!components.length) return null;
        return { components, files: files.list, flags: MessageFlags.IsComponentsV2, allowedMentions } as unknown as MessageCreateOptions;
    }
    const e = design.embed ?? {};
    const embed: Record<string, unknown> = {
        ...(e.title?.trim() ? { title: fill(e.title).slice(0, 256) } : {}),
        ...(e.url ? { url: e.url } : {}),
        ...(e.description?.trim() ? { description: fill(e.description).slice(0, 4096) } : {}),
        ...(hex(e.color) !== undefined ? { color: hex(e.color) } : {}),
        ...(e.author?.trim() ? { author: { name: fill(e.author.trim()).slice(0, 256) } } : {}),
        ...(e.fields?.length ? { fields: e.fields.slice(0, 25).map(f => ({ name: fill(f.name).slice(0, 256) || "​", value: fill(f.value).slice(0, 1024) || "​", inline: f.inline })) } : {}),
        ...(e.thumbnail ? { thumbnail: { url: files.url(e.thumbnail) } } : {}),
        ...(e.image ? { image: { url: files.url(e.image) } } : {}),
        ...(e.footer?.trim() ? { footer: { text: fill(e.footer.trim()).slice(0, 2048) } } : {}),
    };
    if (Object.keys(embed).length === 0) return null;
    return { embeds: [embed], files: files.list, allowedMentions } as unknown as MessageCreateOptions;
}
