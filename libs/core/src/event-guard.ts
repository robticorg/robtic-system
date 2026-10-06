import { Events } from "discord.js";

/**
 * A gate in front of every event listener: the Gateway's split-brain protection decides, once
 * per Discord event, whether this process handles it. All listeners of one event share the
 * decision (one Redis call per event, not per listener).
 *
 * No guard installed (no Redis, or a single Gateway) → every event is handled, synchronously,
 * exactly as before.
 */

export type EventGuard = (eventId: string) => Promise<boolean>;

let guard: EventGuard | null = null;
const decisions = new Map<string, Promise<boolean>>();

export function setEventGuard(next: EventGuard | null): void {
    guard = next;
    decisions.clear();
}

type Snowflaked = { id: string };

/** A stable id for the events two sessions would both receive — the ones that do real work. */
export function eventIdFor(name: string, args: readonly unknown[]): string | null {
    const first = args[0] as Record<string, unknown> | undefined;
    if (!first) return null;
    switch (name) {
        case Events.MessageCreate:
            return `msg:${(first as Snowflaked).id}`;
        case Events.InteractionCreate:
            return `int:${(first as Snowflaked).id}`;
        case Events.MessageReactionAdd: {
            const reaction = first as unknown as { message: Snowflaked; emoji: { id: string | null; name: string | null } };
            const user = args[1] as Snowflaked | undefined;
            return `react:${reaction.message.id}:${user?.id}:${reaction.emoji.id ?? reaction.emoji.name}`;
        }
        case Events.GuildMemberAdd: {
            const member = first as unknown as { id: string; guild: Snowflaked; joinedTimestamp: number | null };
            return `join:${member.guild.id}:${member.id}:${member.joinedTimestamp}`;
        }
        default:
            return null;
    }
}

/** `true` (handle now) or a promise of the verdict. Fails open: a guard error means "handle it". */
export function shouldHandle(name: string, args: readonly unknown[]): true | Promise<boolean> {
    if (!guard) return true;
    const eventId = eventIdFor(name, args);
    if (!eventId) return true;

    let decision = decisions.get(eventId);
    if (!decision) {
        decision = guard(eventId).catch(() => true);
        decisions.set(eventId, decision);
        setTimeout(() => decisions.delete(eventId), 30_000).unref?.();
    }
    return decision;
}
