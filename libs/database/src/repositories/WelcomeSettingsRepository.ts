import { WelcomeSettings, type IWelcomeSettings } from "@database/models/WelcomeSettings";

/** The server's welcome and goodbye (dashboard → Welcome). Read only here: the dashboard writes it. */
export class WelcomeSettingsRepository {
    static async get(guildId: string): Promise<IWelcomeSettings | null> {
        return WelcomeSettings.findOne({ guildId }).lean<IWelcomeSettings>();
    }
}
