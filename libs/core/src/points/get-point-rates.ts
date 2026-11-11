import { PointSettingsRepository } from "@database/repositories";
import { POINT_DEFAULTS } from "@constants";

export interface PointRates {
    messagesPerPoint: number;
    comboPerPoint: number;
    voiceMinutesPerPoint: number;
    streakRewards: { streak: number; points: number }[];
    pointsPerRc: number;
    conversionEnabled: boolean;
    minConversionPoints: number;
    staffMessagesPerPoint: number;
}

/** The guild's economy rates. Settings are upserted with schema defaults, so nothing to fall back to. */
export async function getPointRates(guildId: string): Promise<PointRates> {
    const s = await PointSettingsRepository.getCached(guildId);

    return {
        messagesPerPoint: s.messagesPerPoint,
        comboPerPoint: s.comboPerPoint,
        voiceMinutesPerPoint: s.voiceMinutesPerPoint,
        streakRewards: s.streakRewards.map(r => ({ streak: r.streak, points: r.points })),
        pointsPerRc: s.pointsPerRc,
        conversionEnabled: s.conversionEnabled,
        minConversionPoints: s.minConversionPoints,
        // Rows saved before the field existed read it as the default.
        staffMessagesPerPoint: s.staffMessagesPerPoint ?? POINT_DEFAULTS.staffMessagesPerPoint,
    };
}
