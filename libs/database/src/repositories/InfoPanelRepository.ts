import { isValidObjectId } from "mongoose";
import { InfoPanel, type IInfoOption, type IInfoPanel, type InfoPanelType } from "@database/models/InfoPanel";

export class InfoPanelRepository {
    static async create(entry: {
        guildId: string;
        channelId: string;
        description: string;
        type: InfoPanelType;
        image: Buffer | null;
        imageName: string | null;
        createdBy: string;
    }): Promise<IInfoPanel> {
        return InfoPanel.create({ ...entry, messageId: null, options: [] });
    }

    /** `null` for an id that isn't one — a stale button or a hand-typed autocomplete value. */
    static async get(guildId: string, id: string): Promise<IInfoPanel | null> {
        if (!isValidObjectId(id)) return null;
        return InfoPanel.findOne({ _id: id, guildId });
    }

    /** Without the image — for answering a click, which never shows it. */
    static async getLight(guildId: string, id: string): Promise<IInfoPanel | null> {
        if (!isValidObjectId(id)) return null;
        return InfoPanel.findOne({ _id: id, guildId }).select("-image");
    }

    static async update(guildId: string, id: string, changes: Partial<Pick<IInfoPanel,
        "channelId" | "description" | "type" | "image" | "imageName">>): Promise<IInfoPanel | null> {
        if (!isValidObjectId(id)) return null;
        return InfoPanel.findOneAndUpdate({ _id: id, guildId }, { $set: changes }, { returnDocument: "after" });
    }

    static async setPost(id: string, channelId: string, messageId: string): Promise<void> {
        await InfoPanel.updateOne({ _id: id }, { $set: { channelId, messageId } });
    }

    static async addOption(guildId: string, id: string, option: IInfoOption): Promise<IInfoPanel | null> {
        if (!isValidObjectId(id)) return null;
        return InfoPanel.findOneAndUpdate({ _id: id, guildId }, { $push: { options: option } }, { returnDocument: "after" });
    }

    static async removeOption(guildId: string, id: string, optionId: string): Promise<IInfoPanel | null> {
        if (!isValidObjectId(id)) return null;
        return InfoPanel.findOneAndUpdate({ _id: id, guildId }, { $pull: { options: { optionId } } }, { returnDocument: "after" });
    }

    static async delete(guildId: string, id: string): Promise<IInfoPanel | null> {
        if (!isValidObjectId(id)) return null;
        return InfoPanel.findOneAndDelete({ _id: id, guildId }).select("-image");
    }

    /** This guild's panels, newest first, without images — for autocomplete. */
    static async list(guildId: string, limit: number): Promise<IInfoPanel[]> {
        return InfoPanel.find({ guildId }).select("-image").sort({ createdAt: -1 }).limit(limit);
    }
}
