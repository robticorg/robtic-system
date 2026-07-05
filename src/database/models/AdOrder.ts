import { Document, model, Schema } from "mongoose";
import type { AdSection } from "@database/models/AdsConfig";

export interface IAdOrderItem {
    section: AdSection;
    key: string;
    name: string;
    priceUsd: number;
}

export interface IAdOrder extends Document {
    guildId: string;
    userId: string;
    items: IAdOrderItem[];
    totalUsd: number;
    status: "pending" | "approved" | "rejected";
    reviewMessageId?: string;
    decidedBy?: string;
    decidedAt?: Date;
    createdAt: Date;
}

const AdOrderItemSchema = new Schema<IAdOrderItem>(
    {
        section: { type: String, required: true },
        key: { type: String, required: true },
        name: { type: String, required: true },
        priceUsd: { type: Number, required: true },
    },
    { _id: false }
);

const AdOrderSchema = new Schema<IAdOrder>({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    items: { type: [AdOrderItemSchema], default: [] },
    totalUsd: { type: Number, required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    reviewMessageId: { type: String },
    decidedBy: { type: String },
    decidedAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
});

export const AdOrder = model<IAdOrder>("AdOrder", AdOrderSchema);
