import { RE2JS } from "re2js";
import type { AutoReplyMatchMode, IAutoReplyVariant } from "@database/models";

// The auto reply matcher. Mirrors the dashboard's (robtic-discord `libs/shared/src/autoreply.ts`) so the dashboard's
// test box predicts what the bot does — except that regex runs on RE2 here (re2js): linear time, so a pattern a
// member's admin wrote can never freeze the bot, whatever the message.

/** Only this much of a message is checked (same as the dashboard). */
export const MESSAGE_CHECK_CHARS = 1000;

const TASHKEEL = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;
const TATWEEL = /ـ/g;

/** Arabic spelling variants folded together (only for servers whose bot language is Arabic). "مَرحباً" → "مرحبا". */
export function normalizeArabic(text: string): string {
    return text.replace(TASHKEEL, "").replace(TATWEEL, "").replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
}

function prepare(text: string, caseSensitive: boolean, arabic: boolean): string {
    let t = text.normalize("NFC");
    if (arabic) t = normalizeArabic(t);
    if (!caseSensitive) t = t.toLocaleLowerCase();
    return t.replace(/\s+/g, " ").trim();
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A whole-word test that also works for Arabic (no letter or digit of any script right before or after). */
function hasWord(haystack: string, word: string): boolean {
    return new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegex(word)}(?![\\p{L}\\p{N}_])`, "u").test(haystack);
}

const compiled = new Map<string, RE2JS | null>();
/** RE2 patterns are cached by source + flags; a pattern RE2 rejects is remembered as null and simply never matches. */
function re2(pattern: string, caseSensitive: boolean): RE2JS | null {
    const key = `${caseSensitive ? "c" : "i"}:${pattern}`;
    if (compiled.has(key)) return compiled.get(key)!;
    let p: RE2JS | null = null;
    try { p = RE2JS.compile(pattern, caseSensitive ? 0 : RE2JS.CASE_INSENSITIVE); } catch { p = null; }
    if (compiled.size > 5000) compiled.clear();
    compiled.set(key, p);
    return p;
}

export interface MatchResult {
    trigger: string;
    match: string;
    groups: string[];
}

export interface MatchableRule {
    triggers: string[];
    matchMode: AutoReplyMatchMode;
    caseSensitive: boolean;
}

/** Whether a message matches one of the rule's triggers. Roles, channels, cooldowns and chance are checked by the caller. */
export function matchRule(rule: MatchableRule, message: string, arabic: boolean): MatchResult | null {
    const raw = message.slice(0, MESSAGE_CHECK_CHARS);
    const msg = prepare(raw, rule.caseSensitive, arabic);
    for (const trigger of rule.triggers) {
        if (rule.matchMode === "regex") {
            const p = re2(trigger, rule.caseSensitive);
            if (!p) continue;
            const m = p.matcher(arabic ? normalizeArabic(raw) : raw);
            if (!m.find()) continue;
            const groups: string[] = [];
            for (let i = 1; i <= Math.min(9, m.groupCount()); i++) groups.push(m.group(i) ?? "");
            return { trigger, match: m.group(0) ?? "", groups };
        }
        const t = prepare(trigger, rule.caseSensitive, arabic);
        if (!t) continue;
        const hit =
            rule.matchMode === "exact" ? msg === t
            : rule.matchMode === "contains" ? msg.includes(t)
            : rule.matchMode === "starts" ? msg.startsWith(t)
            : rule.matchMode === "ends" ? msg.endsWith(t)
            : hasWord(msg, t);
        if (hit) return { trigger, match: trigger, groups: [] };
    }
    return null;
}

/** Equal chance, or by weight; with no-repeat the previous reply is skipped when there's another. */
export function pickReply(replies: IAutoReplyVariant[], weighted: boolean, noRepeat: boolean, previous: number | null, random = Math.random): number {
    let pool = replies.map((r, i) => ({ i, w: weighted ? Math.max(1, r.weight || 1) : 1 }));
    if (noRepeat && previous !== null && pool.length > 1) pool = pool.filter((x) => x.i !== previous);
    const total = pool.reduce((s, x) => s + x.w, 0);
    let n = random() * total;
    for (const x of pool) {
        n -= x.w;
        if (n < 0) return x.i;
    }
    return pool[pool.length - 1]?.i ?? 0;
}

export interface FillValues {
    userMention: string;
    userName: string;
    server: string;
    channelMention: string;
    memberCount: number;
}

/** {user} {user.name} {server} {channel} {membercount} {match} {1}…{9}. */
export function fillReply(text: string, v: FillValues, m: MatchResult | null): string {
    return text
        .replace(/\{user\.name\}/g, v.userName)
        .replace(/\{user\}/g, v.userMention)
        .replace(/\{server\}/g, v.server)
        .replace(/\{channel\}/g, v.channelMention)
        .replace(/\{membercount\}/g, v.memberCount.toLocaleString("en"))
        .replace(/\{match\}/g, m?.match ?? "")
        .replace(/\{([1-9])\}/g, (_, n: string) => m?.groups[Number(n) - 1] ?? "");
}

/** Whether `hour` (0–23, UTC) falls inside from–to; a window that wraps midnight (22 → 6) works too. */
export function inActiveHours(hours: { from: number; to: number } | null, hour: number): boolean {
    if (!hours) return true;
    const { from, to } = hours;
    return from <= to ? hour >= from && hour <= to : hour >= from || hour <= to;
}
