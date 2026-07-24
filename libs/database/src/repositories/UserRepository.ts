import { User, type IUser } from "@database/models/User";

export class UserRepository {
    static async getOrCreate(discordId: string, username: string): Promise<IUser> {
        let user = await User.findOne({ discordId });
        if (!user) {
            user = await User.create({ discordId, username });
        }
        return user;
    }

    static async getPreferredLang(discordId: string): Promise<"en" | "ar" | null> {
        const user = await User.findOne({ discordId });
        return user?.preferredLang ?? null;
    }

    static async setPreferredLang(discordId: string, username: string, lang: "en" | "ar"): Promise<IUser> {
        return User.findOneAndUpdate(
            { discordId },
            { $set: { preferredLang: lang }, $setOnInsert: { username } },
            { upsert: true, returnDocument: "after" }
        ) as Promise<IUser>;
    }

    static async getDisplayName(discordId: string): Promise<string | null> {
        const user = await User.findOne({ discordId });
        return user?.displayName ?? null;
    }

    static async setDisplayName(discordId: string, username: string, displayName: string): Promise<IUser> {
        return User.findOneAndUpdate(
            { discordId },
            { $set: { displayName }, $setOnInsert: { username } },
            { upsert: true, returnDocument: "after" }
        ) as Promise<IUser>;
    }

    static async getPrivateProfile(discordId: string): Promise<boolean> {
        const user = await User.findOne({ discordId });
        return user?.privateProfile ?? false;
    }

    static async setPrivateProfile(discordId: string, username: string, value: boolean): Promise<IUser> {
        return User.findOneAndUpdate(
            { discordId },
            { $set: { privateProfile: value }, $setOnInsert: { username } },
            { upsert: true, returnDocument: "after" }
        ) as Promise<IUser>;
    }

    static async getCustomization(discordId: string): Promise<{
        profileColor: string | null;
        textColor: string | null;
        bannerUrl: string | null;
        bio: string | null;
        profileTemplate: string | null;
    }> {
        const user = await User.findOne({ discordId });
        return {
            profileColor: user?.profileColor ?? null,
            textColor: user?.textColor ?? null,
            bannerUrl: user?.bannerUrl ?? null,
            bio: user?.bio ?? null,
            profileTemplate: user?.profileTemplate ?? null,
        };
    }

    /** Partial write — only the provided keys change; empty strings clear a field. */
    static async setCustomization(
        discordId: string,
        username: string,
        update: Partial<{ profileColor: string; textColor: string; bannerUrl: string; bio: string; profileTemplate: string }>,
    ): Promise<IUser> {
        const set: Record<string, string> = {};
        const unset: Record<string, 1> = {};
        for (const [key, value] of Object.entries(update)) {
            if (value === undefined) continue;
            if (value === "") unset[key] = 1;
            else set[key] = value;
        }
        return User.findOneAndUpdate(
            { discordId },
            {
                ...(Object.keys(set).length ? { $set: set } : {}),
                ...(Object.keys(unset).length ? { $unset: unset } : {}),
                $setOnInsert: { username },
            },
            { upsert: true, returnDocument: "after" }
        ) as Promise<IUser>;
    }
}
