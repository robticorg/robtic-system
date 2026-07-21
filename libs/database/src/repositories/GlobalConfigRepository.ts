import { GlobalConfig } from "@database/models/GlobalConfig";

export class GlobalConfigRepository {
    static async get(key: string): Promise<string | null> {
        const doc = await GlobalConfig.findOne({ key });
        return doc?.value ?? null;
    }

    static async set(key: string, value: string): Promise<void> {
        await GlobalConfig.findOneAndUpdate(
            { key },
            { key, value },
            { upsert: true }
        );
    }

    static async delete(key: string): Promise<void> {
        await GlobalConfig.deleteOne({ key });
    }
}
