import { Document, model, Schema } from "mongoose";

export interface ISubmitConfig extends Document {
    guildId: string;
    reviewChannelId: string;
    panelChannelId?: string;
    panelMessageId?: string;
}

const SubmitConfigSchema = new Schema<ISubmitConfig>({
    guildId: { type: String, required: true, unique: true },
    reviewChannelId: { type: String, default: "" },
    panelChannelId: { type: String },
    panelMessageId: { type: String },
});

export const SubmitConfig = model<ISubmitConfig>("SubmitConfig", SubmitConfigSchema);
