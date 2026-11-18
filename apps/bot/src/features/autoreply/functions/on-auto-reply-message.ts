import type { GuildMember, Message, MessageCreateOptions } from "discord.js";
import type { BotClient } from "@core/bot-client";
import type { IAutoReplyDoc } from "@database/models";
import { AutoReplyRepository, ServerConfigRepository } from "@database/repositories";
import { isFeatureEnabled } from "@core/features";
import { DEFAULT_PREFIX } from "@constants";
import { currentLang } from "@utils/lang-context";
import { Logger } from "@logger";
import { matchShortcut } from "@bot/features/shortcuts/functions/match-shortcut";
import { fillReply, inActiveHours, matchRule, pickReply } from "./match";

/** One message never gets more than this many auto replies, even when several rules match and don't stop. */
const MAX_REPLIES_PER_MESSAGE = 3;

// Cooldowns and "no repeat" memory live in this process: rules are per guild and the primary gateway handles a guild's
// messages, so there is one place to remember them. A restart forgets them, which only means one early reply.
const cooldownUntil = new Map<string, number>();
const lastPicked = new Map<string, number>();

function onCooldown(key: string, now: number): boolean {
    const until = cooldownUntil.get(key);
    if (until && until > now) return true;
    if (until) cooldownUntil.delete(key);
    return false;
}

function startCooldowns(rule: IAutoReplyDoc, message: Message, now: number): void {
    const c = rule.cooldowns ?? { userSeconds: 0, channelSeconds: 0, serverSeconds: 0 };
    const base = `${message.guildId}:${rule.ruleId}`;
    if (c.userSeconds > 0) cooldownUntil.set(`${base}:u:${message.author.id}`, now + c.userSeconds * 1000);
    if (c.channelSeconds > 0) cooldownUntil.set(`${base}:c:${message.channelId}`, now + c.channelSeconds * 1000);
    if (c.serverSeconds > 0) cooldownUntil.set(`${base}:s`, now + c.serverSeconds * 1000);
    if (cooldownUntil.size > 50_000) for (const [k, v] of cooldownUntil) if (v <= now) cooldownUntil.delete(k);
}

function anyCooldown(rule: IAutoReplyDoc, message: Message, now: number): boolean {
    const base = `${message.guildId}:${rule.ruleId}`;
    return onCooldown(`${base}:u:${message.author.id}`, now) || onCooldown(`${base}:c:${message.channelId}`, now) || onCooldown(`${base}:s`, now);
}

/** Roles, channels, hours and chance — everything but the text. */
function allowedHere(rule: IAutoReplyDoc, message: Message, member: GuildMember): boolean {
    const roles = member.roles.cache;
    const channelId = message.channelId;
    const parentId = "parentId" in message.channel ? message.channel.parentId : null; // threads follow their channel
    const inList = (ids: string[]) => ids.includes(channelId) || (parentId !== null && ids.includes(parentId));
    if (rule.allowedRoleIds?.length && !rule.allowedRoleIds.some((id) => roles.has(id))) return false;
    if (rule.blockedRoleIds?.some((id) => roles.has(id))) return false;
    if (rule.channelIds?.length && !inList(rule.channelIds)) return false;
    if (rule.blockedChannelIds?.length && inList(rule.blockedChannelIds)) return false;
    if (!inActiveHours(rule.activeHours ?? null, new Date().getUTCHours())) return false;
    if ((rule.chance ?? 100) < 100 && Math.random() * 100 >= rule.chance) return false;
    return true;
}

/** True when the message is a prefix command (`?points`) — commands always win over auto replies. */
async function isCommand(message: Message, client: BotClient): Promise<boolean> {
    const prefix = (await ServerConfigRepository.getPrefix(message.guildId!)) ?? DEFAULT_PREFIX;
    if (!message.content.startsWith(prefix)) return false;
    const first = message.content.slice(prefix.length).trim().split(/\s+/)[0]?.toLowerCase();
    return !!first && (client.commands.has(first) || client.messageCommands.has(first));
}

async function answer(rule: IAutoReplyDoc, message: Message, member: GuildMember, result: NonNullable<ReturnType<typeof matchRule>>): Promise<boolean> {
    const guild = message.guild!;
    let did = false;

    if (rule.reaction) {
        await message.react(rule.reaction).then(() => { did = true; }).catch(() => null);
    }

    if (!rule.reactOnly && rule.replies?.length) {
        const memoryKey = `${guild.id}:${rule.ruleId}:${message.channelId}`;
        const index = pickReply(rule.replies, rule.weighted, rule.noRepeat, lastPicked.get(memoryKey) ?? null);
        lastPicked.set(memoryKey, index);
        if (lastPicked.size > 20_000) lastPicked.clear();
        const variant = rule.replies[index]!;
        const content = fillReply(variant.text ?? "", {
            userMention: `<@${message.author.id}>`,
            userName: member.displayName,
            server: guild.name,
            channelMention: `<#${message.channelId}>`,
            memberCount: guild.memberCount,
        }, result).slice(0, 2000);
        // Only https files (images.robtic.org once uploads are live) — never a path or another scheme.
        const files = (variant.attachments ?? []).filter((a) => /^https:\/\//.test(a.url)).slice(0, 3).map((a) => ({ attachment: a.url, name: a.name || "file" }));
        if (content.trim() || files.length) {
            // A reply may mention the member who triggered it, never @everyone, @here or roles (even through {match}).
            const payload: MessageCreateOptions = { content: content || undefined, files, allowedMentions: { parse: [], users: [message.author.id], repliedUser: true } };
            const sent = rule.replyType === "channel" || !message.channel.isSendable()
                ? (message.channel.isSendable() ? await message.channel.send(payload).catch(() => null) : null)
                : await message.reply(payload).catch(() => null);
            if (sent) {
                did = true;
                if (rule.deleteReplyAfter > 0) setTimeout(() => void sent.delete().catch(() => null), Math.min(rule.deleteReplyAfter, 3600) * 1000);
            }
        }
    }

    if (did && rule.deleteTrigger) await message.delete().catch(() => null);
    return did;
}

export async function onAutoReplyMessage(message: Message, client: BotClient): Promise<void> {
    if (message.author.bot || message.webhookId || !message.inGuild() || !message.member) return;
    if (!message.content) return;

    const rules = await AutoReplyRepository.listCached(message.guildId);
    if (!rules.length) return;
    if (!(await isFeatureEnabled(message.guildId, "autoreply"))) return;
    if (await isCommand(message, client)) return;

    const member = message.member;
    // A shortcut phrase runs its command; the dashboard refuses such triggers, this covers older rules and edge cases.
    if ((await isFeatureEnabled(message.guildId, "shortcuts")) && (await matchShortcut(message, member).catch(() => null))) return;

    const arabic = currentLang() === "ar";
    const now = Date.now();
    let replies = 0;

    for (const rule of rules) {
        if (replies >= MAX_REPLIES_PER_MESSAGE) break;
        if (!rule.enabled || !rule.triggers?.length) continue;
        const result = matchRule({ triggers: rule.triggers, matchMode: rule.matchMode, caseSensitive: rule.caseSensitive }, message.content, arabic);
        if (!result) continue;
        if (!allowedHere(rule, message, member)) continue;
        if (anyCooldown(rule, message, now)) continue;

        try {
            const did = await answer(rule, message, member, result);
            if (!did) continue;
            startCooldowns(rule, message, now);
            AutoReplyRepository.recordUse(message.guildId, rule.ruleId);
            replies++;
            if (rule.stopAfterMatch !== false) break;
            if (rule.deleteTrigger) break; // the message is gone
        } catch (e) {
            Logger.warn(`Auto reply ${rule.ruleId} failed in ${message.guildId}: ${(e as Error).message}`, "autoreply");
        }
    }
}
