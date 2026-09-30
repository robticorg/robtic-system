import { isValidObjectId } from "mongoose";
import { PartnerServer, type IPartnerServer } from "@database/models/PartnerServer";

export class PartnerServerRepository {
    static async create(entry: {
        guildId: string;
        name: string;
        inviteUrl: string;
        representativeId: string;
        description: string;
        image: Buffer;
        addedBy: string;
    }): Promise<IPartnerServer> {
        return PartnerServer.create({ ...entry, channelId: null, messageId: null });
    }

    /** `null` for an id that isn't one — a stale button or a hand-typed autocomplete value. */
    static async get(guildId: string, id: string): Promise<IPartnerServer | null> {
        if (!isValidObjectId(id)) return null;
        return PartnerServer.findOne({ _id: id, guildId });
    }

    /** Every partner in the guild, oldest first. The stored image is left out — lists never show it. */
    static async list(guildId: string): Promise<IPartnerServer[]> {
        return PartnerServer.find({ guildId }).select("-image").sort({ createdAt: 1 });
    }

    /** Every partner in the guild with its stored image, oldest first — for re-rendering their posts. */
    static async listWithImages(guildId: string): Promise<IPartnerServer[]> {
        return PartnerServer.find({ guildId }).sort({ createdAt: 1 });
    }

    /** Replaces a partner's details. `image` is left alone when not given. */
    static async update(guildId: string, id: string, changes: {
        name: string;
        inviteUrl: string;
        representativeId: string;
        description: string;
        image?: Buffer;
    }): Promise<IPartnerServer | null> {
        if (!isValidObjectId(id)) return null;
        return PartnerServer.findOneAndUpdate({ _id: id, guildId }, { $set: changes }, { returnDocument: "after" });
    }

    /** Names for `/partner remove` and `/partner edit` autocomplete. */
    static async search(guildId: string, query: string, limit: number): Promise<Array<{ id: string; name: string }>> {
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const rows = await PartnerServer.find({ guildId, name: { $regex: escaped, $options: "i" } })
            .select("name")
            .sort({ name: 1 })
            .limit(limit);
        return rows.map(row => ({ id: String(row._id), name: row.name }));
    }

    /** How many of this guild's partners `userId` represents — the role stays while this is above zero. */
    static async countByRepresentative(guildId: string, userId: string): Promise<number> {
        return PartnerServer.countDocuments({ guildId, representativeId: userId });
    }

    static async setPost(id: string, channelId: string, messageId: string): Promise<void> {
        await PartnerServer.updateOne({ _id: id }, { $set: { channelId, messageId } });
    }

    static async delete(guildId: string, id: string): Promise<IPartnerServer | null> {
        if (!isValidObjectId(id)) return null;
        return PartnerServer.findOneAndDelete({ _id: id, guildId });
    }
}
