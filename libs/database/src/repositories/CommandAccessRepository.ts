import { CommandAccess, type ICommandAccess } from "@database/models/CommandAccess";

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { entries: ICommandAccess[]; expiresAt: number }>();

export class CommandAccessRepository {
    static async listForGuild(guildId: string): Promise<ICommandAccess[]> {
        return CommandAccess.find({ guildId });
    }

    /** Hot-path entry point — read on every command invocation via checkPermissions. */
    static async getCached(guildId: string): Promise<ICommandAccess[]> {
        const cached = cache.get(guildId);
        if (cached && cached.expiresAt > Date.now()) return cached.entries;

        const entries = await this.listForGuild(guildId);
        cache.set(guildId, { entries, expiresAt: Date.now() + CACHE_TTL_MS });
        return entries;
    }

    static async getForCommand(guildId: string, commandName: string): Promise<ICommandAccess | null> {
        const entries = await this.getCached(guildId);
        return entries.find(e => e.commandName === commandName) ?? null;
    }

    static invalidate(guildId: string): void {
        cache.delete(guildId);
    }

    static async addRole(guildId: string, commandName: string, roleId: string): Promise<ICommandAccess> {
        const entry = await CommandAccess.findOneAndUpdate(
            { guildId, commandName },
            { $addToSet: { allowedRoleIds: roleId } },
            { upsert: true, returnDocument: "after" }
        ) as ICommandAccess;
        this.invalidate(guildId);
        return entry;
    }

    static async removeRole(guildId: string, commandName: string, roleId: string): Promise<ICommandAccess> {
        const entry = await CommandAccess.findOneAndUpdate(
            { guildId, commandName },
            { $pull: { allowedRoleIds: roleId } },
            { upsert: true, returnDocument: "after" }
        ) as ICommandAccess;
        this.invalidate(guildId);
        return entry;
    }

    static async addCategory(guildId: string, commandName: string, categoryKey: string): Promise<ICommandAccess> {
        const entry = await CommandAccess.findOneAndUpdate(
            { guildId, commandName },
            { $addToSet: { allowedCategoryKeys: categoryKey } },
            { upsert: true, returnDocument: "after" }
        ) as ICommandAccess;
        this.invalidate(guildId);
        return entry;
    }

    static async removeCategory(guildId: string, commandName: string, categoryKey: string): Promise<ICommandAccess> {
        const entry = await CommandAccess.findOneAndUpdate(
            { guildId, commandName },
            { $pull: { allowedCategoryKeys: categoryKey } },
            { upsert: true, returnDocument: "after" }
        ) as ICommandAccess;
        this.invalidate(guildId);
        return entry;
    }
}
