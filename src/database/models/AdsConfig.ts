import { Document, model, Schema } from "mongoose";

export type AdSection = "standardAds" | "giveaway" | "packages" | "addons";

export interface IAdItem {
    key: string;
    name: string;
    priceUsd: number;
    /** Markdown shown in detail views — duration, "Includes" bullets, notes, etc. */
    details?: string;
}

export interface IAdsConfig extends Document {
    guildId: string;
    /** Credits per 1 USD. */
    exchangeRate: number;
    approvalChannelId?: string;
    panelChannelId?: string;
    panelMessageId?: string;
    /** Role allowed to accept/reject ad orders and claim ad tickets. */
    managerRoleId?: string;
    standardAds: IAdItem[];
    giveaway: IAdItem[];
    packages: IAdItem[];
    addons: IAdItem[];
}

const AdItemSchema = new Schema<IAdItem>(
    {
        key: { type: String, required: true },
        name: { type: String, required: true },
        priceUsd: { type: Number, required: true },
        details: { type: String },
    },
    { _id: false }
);

const AdsConfigSchema = new Schema<IAdsConfig>({
    guildId: { type: String, required: true, unique: true },
    exchangeRate: { type: Number, default: 12_500_000 },
    approvalChannelId: { type: String },
    panelChannelId: { type: String },
    panelMessageId: { type: String },
    managerRoleId: { type: String },
    standardAds: { type: [AdItemSchema], default: [] },
    giveaway: { type: [AdItemSchema], default: [] },
    packages: { type: [AdItemSchema], default: [] },
    addons: { type: [AdItemSchema], default: [] },
});

export const AdsConfig = model<IAdsConfig>("AdsConfig", AdsConfigSchema);
