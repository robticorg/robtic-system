import { Coin, type ICoin } from "@database/models/Coin";

export class CoinsRepository {
    static async findOrCreate(guildId: string, discordId: string, username: string): Promise<ICoin> {
        return Coin.findOneAndUpdate(
            { guildId, discordId },
            { $setOnInsert: { username } },
            { upsert: true, returnDocument: "after" }
        ) as Promise<ICoin>;
    }

    static async get(guildId: string, discordId: string): Promise<ICoin | null> {
        return Coin.findOne({ guildId, discordId });
    }

    static async addCoins(guildId: string, discordId: string, username: string, amount: number): Promise<ICoin> {
        return Coin.findOneAndUpdate(
            { guildId, discordId },
            { $inc: { coins: amount }, $setOnInsert: { username } },
            { upsert: true, returnDocument: "after" }
        ) as Promise<ICoin>;
    }

    /**
     * Adds progress toward the next coin of one kind ("message" or "combo") and converts every
     * full `rate` into a coin, keeping the remainder. Returns how many coins were just earned.
     */
    static async addProgress(
        guildId: string,
        discordId: string,
        username: string,
        kind: "message" | "combo",
        amount: number,
        rate: number,
    ): Promise<number> {
        if (rate <= 0 || amount <= 0) return 0;
        const field = kind === "message" ? "messageProgress" : "comboProgress";

        const record = await Coin.findOneAndUpdate(
            { guildId, discordId },
            { $inc: { [field]: amount }, $setOnInsert: { username } },
            { upsert: true, returnDocument: "after" }
        ) as ICoin;

        const progress = kind === "message" ? record.messageProgress : record.comboProgress;
        const earned = Math.floor(progress / rate);
        if (earned <= 0) return 0;

        await Coin.updateOne(
            { guildId, discordId },
            { $inc: { coins: earned, [field]: -earned * rate } }
        );
        return earned;
    }

    static async getTop(guildId: string, limit = 10): Promise<ICoin[]> {
        return Coin.find({ guildId, coins: { $gt: 0 } }).sort({ coins: -1 }).limit(limit);
    }

    static async getRank(guildId: string, discordId: string): Promise<number> {
        const record = await Coin.findOne({ guildId, discordId });
        if (!record || record.coins <= 0) return 0;
        const above = await Coin.countDocuments({ guildId, coins: { $gt: record.coins } });
        return above + 1;
    }
}
