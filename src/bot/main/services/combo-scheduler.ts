import type { Client, Guild } from "discord.js";
import { COMBO_CONFIG } from "@core/config";
import { Logger } from "@core/libs";
import { ComboRepository, ComboUserStatsRepository } from "@database/repositories";
import { finalizeExpiredCombos } from "./combo-service";
import { computeHeat } from "./combo-heat";
import { snapshotActivePairs } from "./combo-leaderboard-service";
import { pruneStaleChannelBuffers } from "./combo-conversation-detector";
import { syncChampionRole } from "../utils/comboChampionRole";

const CTX = "main:combo-scheduler";

async function processGuildCombos(guild: Guild): Promise<void> {
    const now = Date.now();
    const stillActive = await finalizeExpiredCombos(guild);

    const scoreByUser = new Map<string, number>();

    for (const pair of stillActive) {
        const elapsed = now - pair.lastMessageAt.getTime();

        const decayedHeat = computeHeat(pair.heat, elapsed, false, 0);
        if (Math.round(decayedHeat) !== Math.round(pair.heat)) {
            await ComboRepository.setHeat(guild.id, pair.userLowId, pair.userHighId, decayedHeat);
            pair.heat = decayedHeat;
        }

        scoreByUser.set(pair.userLowId, Math.max(scoreByUser.get(pair.userLowId) ?? 0, pair.currentScore));
        scoreByUser.set(pair.userHighId, Math.max(scoreByUser.get(pair.userHighId) ?? 0, pair.currentScore));
    }

    if (stillActive.length > 0) {
        await snapshotActivePairs(guild.id, stillActive);
    }

    // Blend in each user's stored all-time best so the Champion role reflects a genuine "best combo
    // ever" — not just whoever happens to be mid-conversation right now — while still updating live
    // if someone's currently in the middle of setting a new personal record.
    const allTimeStats = await ComboUserStatsRepository.getAllForGuild(guild.id);
    for (const stat of allTimeStats) {
        scoreByUser.set(stat.discordId, Math.max(scoreByUser.get(stat.discordId) ?? 0, stat.bestComboScore));
    }

    await syncChampionRole(guild, scoreByUser);
}

export async function runComboCycle(client: Client): Promise<void> {
    for (const [, guild] of client.guilds.cache) {
        await processGuildCombos(guild).catch(err =>
            Logger.error(`Combo cycle failed for guild ${guild.id}: ${err}`, CTX)
        );
    }
    pruneStaleChannelBuffers();
}

let comboInterval: ReturnType<typeof setInterval> | null = null;

export function startComboScheduler(client: Client): void {
    if (comboInterval) return;
    comboInterval = setInterval(() => {
        runComboCycle(client).catch(err =>
            Logger.error(`Combo cycle failed: ${err}`, CTX)
        );
    }, COMBO_CONFIG.scanIntervalMs);

    Logger.info("Combo scheduler started", CTX);
}

export function stopComboScheduler(): void {
    if (comboInterval) {
        clearInterval(comboInterval);
        comboInterval = null;
    }
}
