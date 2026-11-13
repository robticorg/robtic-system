import {
    BaseGuildTextChannel,
    BaseGuildVoiceChannel,
    CommandInteraction,
    DMChannel,
    Message,
    MessageComponentInteraction,
    MessageFlags,
    MessagePayload,
    ModalSubmitInteraction,
    ThreadChannel,
    isJSONEncodable,
} from "discord.js";
import { contentToV2, embedsToV2, type BodyJSON } from "./embeds-to-v2";

/**
 * Puts every message the bot sends into its house style (embeds-to-v2.ts), in one place, so no command can be left
 * in the old embed look. It wraps the send, reply, edit and update methods:
 *
 * - a new message (send, reply, followUp) with embeds becomes V2;
 * - an edit keeps whatever the message already is: a V2 message stays V2 (plain text edits become a container,
 *   since V2 messages can't hold plain content), an older embed message stays an embed, so messages sent before
 *   this existed keep working;
 * - a deferred reply is new until its first edit decides what it is.
 *
 * When a body won't fit V2's limits it is sent as it was.
 */

type Options = Record<string, unknown>;
type AccentFor = (guildId: string | null) => number;

/** Whether an interaction's own reply is V2 (true), plain (false) or not sent yet (absent). Kept 20 minutes. */
const replyStyle = new Map<string, { v2: boolean; at: number }>();
const KEEP_MS = 20 * 60_000;

function remember(id: string, v2: boolean): void {
    replyStyle.set(id, { v2, at: Date.now() });
    if (replyStyle.size > 500) for (const [k, v] of replyStyle) if (Date.now() - v.at > KEEP_MS) replyStyle.delete(k);
}

const isV2Flags = (flags: unknown): boolean => {
    try {
        return flags != null && (BigInt(flags as number) & BigInt(MessageFlags.IsComponentsV2)) !== 0n;
    } catch {
        return false;
    }
};

const toJSON = (x: unknown) => (isJSONEncodable(x) ? x.toJSON() : x);

/** discord.js options → the raw body the converter works on, or null when there is nothing to do. */
function bodyOf(options: unknown): BodyJSON | null {
    if (options instanceof MessagePayload) return null;
    const o: Options = typeof options === "string" ? { content: options } : (options as Options) ?? {};
    const flags = o.flags as unknown;
    let flagBits: number;
    try { flagBits = Array.isArray(flags) ? flags.reduce((n: number, f) => n | Number(f), 0) : Number(flags ?? 0); } catch { return null; }
    const allowed = o.allowedMentions as { parse?: string[]; users?: string[]; roles?: string[]; repliedUser?: boolean } | undefined;
    return {
        content: typeof o.content === "string" ? o.content : null,
        embeds: Array.isArray(o.embeds) ? (o.embeds.map(toJSON) as BodyJSON["embeds"]) : null,
        components: Array.isArray(o.components) ? (o.components.map(toJSON) as BodyJSON["components"]) : null,
        flags: flagBits,
        allowed_mentions: allowed ? { parse: allowed.parse, users: allowed.users, roles: allowed.roles, replied_user: allowed.repliedUser } : undefined,
    };
}

/** The converted body back as discord.js options, keeping everything the converter doesn't touch (files, reply…). */
function optionsOf(original: unknown, body: BodyJSON): Options {
    const o: Options = typeof original === "string" ? {} : { ...(original as Options) };
    delete o.content;
    delete o.embeds;
    const a = body.allowed_mentions;
    return {
        ...o,
        components: body.components,
        flags: Number(body.flags),
        allowedMentions: a ? { parse: a.parse, users: a.users, roles: a.roles, ...(a.replied_user !== undefined ? { repliedUser: a.replied_user } : {}) } : o.allowedMentions,
    };
}

/**
 * Restyles one call's options. `mode`: "new" converts embeds; "v2" (editing a V2 message) converts embeds and plain
 * text; "plain" (editing an older message) leaves it alone. Returns the options to send and whether they are V2.
 */
function restyle(options: unknown, mode: "new" | "v2" | "plain", accent: number): { options: unknown; v2: boolean } {
    if (mode === "plain") return { options, v2: false };
    const body = bodyOf(options);
    if (!body) return { options, v2: false };
    if (isV2Flags(body.flags)) return { options, v2: true };

    if (body.embeds?.length) {
        const converted = embedsToV2(body, accent);
        return converted ? { options: optionsOf(options, converted), v2: true } : { options, v2: false };
    }
    if (mode === "v2" && body.content) return { options: optionsOf(options, contentToV2(body, accent)), v2: true };
    return { options, v2: mode === "v2" };
}

type Fn = (this: unknown, ...args: unknown[]) => unknown;

function wrap(proto: object, method: string, around: (self: never, original: Fn, args: unknown[]) => unknown): void {
    const original = (proto as Record<string, Fn>)[method];
    if (typeof original !== "function" || (original as { houseStyle?: boolean }).houseStyle) return;
    const wrapped = function (this: unknown, ...args: unknown[]) { return around(this as never, original, args); };
    (wrapped as { houseStyle?: boolean }).houseStyle = true;
    (proto as Record<string, Fn>)[method] = wrapped;
}

let installed = false;

/** Installs the wrappers once. `accentFor` gives a server's colour (synchronously, from a cache). */
export function installHouseStyle(accentFor: AccentFor): void {
    if (installed) return;
    installed = true;

    type Interaction = { id: string; guildId: string | null; message?: Message | null };
    const interactions = [CommandInteraction.prototype, MessageComponentInteraction.prototype, ModalSubmitInteraction.prototype];

    for (const proto of interactions) {
        wrap(proto, "reply", (self: Interaction, original, [options, ...rest]) => {
            const r = restyle(options, "new", accentFor(self.guildId));
            remember(self.id, r.v2);
            return original.call(self, r.options, ...rest);
        });
        wrap(proto, "deferReply", (self: Interaction, original, args) => {
            replyStyle.delete(self.id);
            return original.apply(self, args);
        });
        wrap(proto, "editReply", (self: Interaction, original, [options, ...rest]) => {
            // An edit of a follow-up (options.message) is left alone: its style isn't tracked.
            if (options && typeof options === "object" && "message" in (options as Options) && (options as Options).message !== "@original") return original.call(self, options, ...rest);
            const known = replyStyle.get(self.id);
            const r = restyle(options, known ? (known.v2 ? "v2" : "plain") : "new", accentFor(self.guildId));
            remember(self.id, r.v2);
            return original.call(self, r.options, ...rest);
        });
        wrap(proto, "followUp", (self: Interaction, original, [options, ...rest]) =>
            original.call(self, restyle(options, "new", accentFor(self.guildId)).options, ...rest));
        wrap(proto, "update", (self: Interaction, original, [options, ...rest]) => {
            const v2 = Boolean(self.message?.flags?.has(MessageFlags.IsComponentsV2));
            return original.call(self, restyle(options, v2 ? "v2" : "plain", accentFor(self.guildId)).options, ...rest);
        });
    }

    type Channel = { guildId?: string | null };
    for (const proto of [BaseGuildTextChannel.prototype, BaseGuildVoiceChannel.prototype, ThreadChannel.prototype, DMChannel.prototype]) {
        wrap(proto, "send", (self: Channel, original, [options, ...rest]) =>
            original.call(self, restyle(options, "new", accentFor(self.guildId ?? null)).options, ...rest));
    }

    wrap(Message.prototype, "reply", (self: Message, original, [options, ...rest]) =>
        original.call(self, restyle(options, "new", accentFor(self.guildId)).options, ...rest));
    wrap(Message.prototype, "edit", (self: Message, original, [options, ...rest]) => {
        const v2 = self.flags?.has(MessageFlags.IsComponentsV2) ?? false;
        return original.call(self, restyle(options, v2 ? "v2" : "plain", accentFor(self.guildId)).options, ...rest);
    });
}
