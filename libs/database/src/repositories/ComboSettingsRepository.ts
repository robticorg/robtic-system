import { ComboSettings, type IComboSettings } from "@database/models/ComboSettings";

export class ComboSettingsRepository {
    static async get(guildId: string): Promise<IComboSettings | null> {
        return ComboSettings.findOne({ guildId });
    }

    static async getOrCreate(guildId: string): Promise<IComboSettings> {
        let settings = await ComboSettings.findOne({ guildId });
        if (!settings) settings = await ComboSettings.create({ guildId });
        return settings;
    }

    static async setChampionRole(guildId: string, roleId: string | null): Promise<IComboSettings> {
        return ComboSettings.findOneAndUpdate(
            { guildId },
            { $set: { championRoleId: roleId } },
            { upsert: true, returnDocument: "after" }
        ) as Promise<IComboSettings>;
    }

    /** Pass null/null to reset back to COMBO_CONFIG's defaults. */
    static async setScoreRange(guildId: string, min: number | null, max: number | null): Promise<IComboSettings> {
        return ComboSettings.findOneAndUpdate(
            { guildId },
            { $set: { minScorePerMessage: min, maxScorePerMessage: max } },
            { upsert: true, returnDocument: "after" }
        ) as Promise<IComboSettings>;
    }
}
