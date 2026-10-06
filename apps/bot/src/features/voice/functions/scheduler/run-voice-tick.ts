import type { Client, Guild, GuildMember, VoiceBasedChannel } from "discord.js";
import { PeriodicStatRepository, VoiceSettingsRepository } from "@database/repositories";
import { isFeatureEnabled } from "@core/features";
import { publishMetric } from "@core/metrics";
import { VOICE_CONFIG } from "@constants";
import { Logger } from "@logger";
import { QUEUES, enqueue, isRedisConfigured, jobIds, newRequestId } from "@queue";
import { getSession, startSession } from "../session-store";
import { evaluateEligibility } from "../evaluate-eligibility";
import { grantVoiceXp, rollVoiceXp } from "../grant-voice-xp";

const CTX = "voice";
const TICK_SECONDS = VOICE_CONFIG.tickIntervalMs / 1000;
const TICK_MINUTES = TICK_SECONDS / 60;

/**
 * Evaluates every connected member once per interval.
 *
 * Works from the gateway's voice state cache rather than from stored sessions, so a member who was
 * already connected when the bot started is picked up on the first tick — a restart costs at most
 * one interval, not the rest of their evening.
 *
 * Connected time accrues for anyone in a channel; active time and rewards only for members who
 * pass the eligibility rules. The two are tracked separately so "how long were you in voice" and
 * "how long were you actually participating" stay different questions.
 */
export async function runVoiceTick(client: Client): Promise<void> {
    const tickAt = Date.now();
    for (const [, guild] of client.guilds.cache) {
        try {
            if (!(await isFeatureEnabled(guild.id, "voice"))) continue;

            const settings = await VoiceSettingsRepository.getCached(guild.id);
            if (!settings.enabled) continue;

            await tickGuild(guild, settings, tickAt);
        } catch (err) {
            Logger.warn(`Voice tick failed for ${guild.id}: ${err}`, CTX);
        }
    }
}

interface Earned {
    memberId: string;
    username: string;
    xp: number;
}

let lastFallbackWarning = 0;

async function tickGuild(guild: Guild, settings: Awaited<ReturnType<typeof VoiceSettingsRepository.getCached>>, tickAt: number): Promise<void> {
    const earned: Earned[] = [];

    for (const [, state] of guild.voiceStates.cache) {
        const channel = state.channel;
        const member = state.member;

        if (!channel || !member || member.user.bot) continue;

        const session = getSession(guild.id, member.id)
            ?? await startSession(guild.id, member.id, member.user.username, channel.id);
        if (!session) continue;

        session.lastTickAt = Date.now();
        session.connectedSeconds += TICK_SECONDS;
        session.dirty = true;

        const eligibility = await evaluateEligibility(member as GuildMember, channel as VoiceBasedChannel, settings);
        if (!eligibility.eligible) continue;

        session.activeSeconds += TICK_SECONDS;

        const xp = rollVoiceXp(eligibility.multiplier);
        session.xpEarned += xp;
        earned.push({ memberId: member.id, username: member.user.username, xp });
    }

    if (!earned.length) return;

    // With Redis: one job for the whole guild's minute; the worker writes MongoDB and sends level-ups back.
    if (isRedisConfigured()) {
        try {
            await enqueue(
                QUEUES.voice,
                "voice-tick",
                {
                    kind: "voice-tick",
                    guildId: guild.id,
                    tickAt,
                    members: earned.map(e => ({ ...e, seconds: TICK_SECONDS })),
                    requestId: newRequestId(),
                },
                jobIds.voiceTick(guild.id, tickAt),
            );
            return;
        } catch (err) {
            if (Date.now() - lastFallbackWarning > 60_000) {
                lastFallbackWarning = Date.now();
                Logger.warn(`Voice queue unavailable, granting inline: ${(err as Error).message}`, CTX);
            }
        }
    }

    for (const { memberId, username, xp } of earned) {
        await grantVoiceXp(guild, memberId, username, xp, TICK_MINUTES);
        await PeriodicStatRepository.incrementAllPeriods(guild.id, "voiceTime", memberId, TICK_SECONDS);
        publishMetric({ guildId: guild.id, discordId: memberId, username, metric: "voiceTime", value: TICK_SECONDS });
    }
}
