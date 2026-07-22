import type { AdminConfigSnapshot } from "@typings/admin-config";
import {
    ServerConfigRepository,
    XPSettingsRepository,
    StreakSettingsRepository,
    ComboSettingsRepository,
    PunishConfigRepository,
    LogConfigRepository,
} from "@database/repositories";
import { LOG_REGISTRY, STREAK_CONFIG } from "@constants";

/** Reads every editable config section for a guild into one snapshot for the admin panel. */
export async function getAdminConfig(guildId: string): Promise<AdminConfigSnapshot> {
    const [server, xp, streak, combo, punish, logConfigs] = await Promise.all([
        ServerConfigRepository.find(guildId),
        XPSettingsRepository.get(guildId),
        StreakSettingsRepository.get(guildId),
        ComboSettingsRepository.get(guildId),
        PunishConfigRepository.findOrCreate(guildId),
        LogConfigRepository.findAll(),
    ]);

    const logChannels: Record<string, string | null> = {};
    for (const key of Object.keys(LOG_REGISTRY)) {
        // A log config is stored globally per key, but only surface the one pointing at this guild.
        const match = logConfigs.find(entry => entry.key === key && entry.serverId === guildId);
        logChannels[key] = match?.channelId ?? null;
    }

    return {
        server: {
            prefix: server?.prefix ?? null,
            commandsChannelId: server?.commandsChannelId ?? null,
            modmailChannelId: server?.modmailChannelId ?? null,
            roles: {
                members: server?.roles?.members ?? null,
                bots: server?.roles?.bots ?? null,
                en: server?.roles?.en ?? null,
                ar: server?.roles?.ar ?? null,
            },
        },
        xp: {
            chatChannels: xp?.chatChannels ?? [],
            supportChannels: xp?.supportChannels ?? [],
            staffChannels: xp?.staffChannels ?? [],
            allowedRoles: xp?.allowedRoles ?? [],
            decayEnabled: xp?.decayEnabled ?? false,
        },
        streak: {
            channels: streak?.channels ?? [],
            remindersEnabled: streak?.remindersEnabled ?? false,
            minMessageLength: streak?.minMessageLength ?? STREAK_CONFIG.minMessageLength,
        },
        combo: {
            championRoleId: combo?.championRoleId ?? null,
            minScorePerMessage: combo?.minScorePerMessage ?? null,
            maxScorePerMessage: combo?.maxScorePerMessage ?? null,
        },
        punish: {
            pointsPerAction: punish.pointsPerAction,
            proofChannelId: punish.proofChannelId ?? null,
            shortcutRoleIds: punish.shortcutRoleIds ?? [],
        },
        logs: {
            channels: logChannels,
        },
    };
}
