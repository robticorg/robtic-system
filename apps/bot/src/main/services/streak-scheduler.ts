import { EmbedBuilder, type Client, type Guild } from "discord.js";
import { StreakRepository, StreakSettingsRepository, StreakRecoveryRepository } from "@database/repositories";
import { Colors, STREAK_CONFIG } from "@core/config";
import { Logger } from "@core/libs";
import { isStreakExpired, streakExpiresAt } from "@core/utils";
import { applyStreakRole } from "../utils/streakRole";

const CTX = "main:streak-scheduler";

async function processGuildStreaks(client: Client, guild: Guild): Promise<void> {
    const settings = await StreakSettingsRepository.get(guild.id);
    const now = new Date();
    const active = await StreakRepository.findAllActive(guild.id);

    for (const streak of active) {
        if (isStreakExpired(streak.lastIncrement, now)) {
            await StreakRecoveryRepository.create(streak.discordId, guild.id, streak.currentStreak, streak.bestStreak);
            await StreakRepository.expire(streak.discordId, guild.id);

            const member = await guild.members.fetch(streak.discordId).catch(() => null);
            if (member) await applyStreakRole(member, 0);

            const user = member?.user ?? await client.users.fetch(streak.discordId).catch(() => null);
            if (user) {
                const embed = new EmbedBuilder()
                    .setDescription(`💔 لقد انتهى تتابعك.\n\nالتتابع المفقود: ${streak.currentStreak}\n\nيمكن لأحد المشرفين استرجاعه خلال 3 أيام.`)
                    .setColor(Colors.error)
                    .setTimestamp();

                await user.send({ embeds: [embed] }).catch(() => null);
            }

            Logger.debug(`Expired streak for ${streak.discordId} in ${guild.id} (lost ${streak.currentStreak})`, CTX);
            continue;
        }

        if (!settings?.remindersEnabled || streak.reminderSent) continue;

        const msUntilExpire = streakExpiresAt(streak.lastIncrement).getTime() - now.getTime();
        if (msUntilExpire > STREAK_CONFIG.reminderThresholdMs) continue;

        const user = await client.users.fetch(streak.discordId).catch(() => null);
        if (user) {
            const embed = new EmbedBuilder()
                .setDescription("⚠️ سينتهي تتابعك خلال أقل من ساعتين.\n\nأرسل رسالة واحدة في قناة التتابع للحفاظ عليه.")
                .setColor(Colors.warning)
                .setTimestamp();

            await user.send({ embeds: [embed] }).catch(() => null);
        }

        await StreakRepository.markReminderSent(streak.discordId, guild.id);
        Logger.debug(`Sent expiry reminder to ${streak.discordId} in ${guild.id}`, CTX);
    }

    const recoveryCutoff = new Date(now.getTime() - STREAK_CONFIG.recoveryWindowMs);
    await StreakRecoveryRepository.deleteOlderThan(guild.id, recoveryCutoff);
}

export async function runStreakCycle(client: Client): Promise<void> {
    for (const [, guild] of client.guilds.cache) {
        await processGuildStreaks(client, guild);
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
