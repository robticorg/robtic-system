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
            { upsert: true, returnDocument: "after", new: true }
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
            { upsert: true, returnDocument: "after", new: true }
        ) as Promise<IUser>;
    }
}
