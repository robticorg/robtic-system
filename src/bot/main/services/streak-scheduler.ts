import { EmbedBuilder, type Client, type Guild } from "discord.js";
import { StreakRepository, StreakSettingsRepository, StreakRecoveryRepository } from "@database/repositories";
import { Colors, STREAK_CONFIG } from "@core/config";
import { Logger } from "@core/libs";

const CTX = "main:streak-scheduler";

async function processGuildReminders(client: Client, guild: Guild): Promise<void> {
    const settings = await StreakSettingsRepository.get(guild.id);
    if (!settings?.remindersEnabled) return;

    const now = Date.now();
    const notYetExpired = new Date(now - STREAK_CONFIG.expireWindowMs);
    const reminderCutoff = new Date(now - STREAK_CONFIG.expireWindowMs + STREAK_CONFIG.reminderThresholdMs);

    const due = await StreakRepository.findDueForReminder(guild.id, notYetExpired, reminderCutoff);

    for (const streak of due) {
        const user = await client.users.fetch(streak.discordId).catch(() => null);
        if (user) {
            const embed = new EmbedBuilder()
                .setDescription("⚠️ Your streak will expire in less than 2 hours.\n\nSend one message in the streak channel to keep your streak alive.")
                .setColor(Colors.warning)
                .setTimestamp();

            await user.send({ embeds: [embed] }).catch(() => null);
        }

        await StreakRepository.markReminderSent(streak.discordId, guild.id);
        Logger.debug(`Sent expiry reminder to ${streak.discordId} in ${guild.id}`, CTX);
    }
}

async function processGuildExpirations(client: Client, guild: Guild): Promise<void> {
    const now = Date.now();
    const cutoff = new Date(now - STREAK_CONFIG.expireWindowMs);

    const expired = await StreakRepository.findExpired(guild.id, cutoff);

    for (const streak of expired) {
        await StreakRecoveryRepository.create(streak.discordId, guild.id, streak.currentStreak, streak.bestStreak);
        await StreakRepository.expire(streak.discordId, guild.id);

        const user = await client.users.fetch(streak.discordId).catch(() => null);
        if (user) {
            const embed = new EmbedBuilder()
                .setDescription(`💔 Your streak has expired.\n\nLost streak: ${streak.currentStreak}\n\nAn administrator can restore it within 3 days.`)
                .setColor(Colors.error)
                .setTimestamp();

            await user.send({ embeds: [embed] }).catch(() => null);
        }

        Logger.debug(`Expired streak for ${streak.discordId} in ${guild.id} (lost ${streak.currentStreak})`, CTX);
    }

    const recoveryCutoff = new Date(now - STREAK_CONFIG.recoveryWindowMs);
    await StreakRecoveryRepository.deleteOlderThan(guild.id, recoveryCutoff);
}

export async function runStreakCycle(client: Client): Promise<void> {
    for (const [, guild] of client.guilds.cache) {
        await processGuildReminders(client, guild);
        await processGuildExpirations(client, guild);
    }
}

let streakInterval: ReturnType<typeof setInterval> | null = null;

export function startStreakScheduler(client: Client): void {
    if (streakInterval) return;
    streakInterval = setInterval(() => {
        runStreakCycle(client).catch(err =>
            Logger.error(`Streak cycle failed: ${err}`, CTX)
        );
    }, STREAK_CONFIG.checkIntervalMs);

    Logger.info("Streak scheduler started", CTX);
}

export function stopStreakScheduler(): void {
    if (streakInterval) {
        clearInterval(streakInterval);
        streakInterval = null;
    }
}
