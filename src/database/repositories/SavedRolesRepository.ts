import { SavedRoles, type ISavedRoles } from "@database/models/SavedRoles";

export class SavedRolesRepository {
    static async save(guildId: string, userId: string, roles: string[]): Promise<ISavedRoles> {
        return SavedRoles.findOneAndUpdate(
            { guildId, userId },
            { $set: { roles, leftAt: new Date() } },
            { upsert: true, returnDocument: "after", new: true }
        ) as Promise<ISavedRoles>;
    }

    static async find(guildId: string, userId: string): Promise<ISavedRoles | null> {
        return SavedRoles.findOne({ guildId, userId });
    }

    static async remove(guildId: string, userId: string): Promise<void> {
        await SavedRoles.deleteOne({ guildId, userId });
    }
}
