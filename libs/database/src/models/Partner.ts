import { Schema, model, type Document } from "mongoose";

export interface IPartner extends Document {
    partnerServerId: string;
    partnerServerName: string;
    description: string;
    inviteLink?: string;
    repUserId: string;
    addedBy: string;
    createdAt: Date;
    updatedAt: Date;
}

const partnerSchema = new Schema<IPartner>(
    {
        partnerServerId: { type: String, required: true, unique: true, trim: true },
        partnerServerName: { type: String, required: true, trim: true },
        description: { type: String, required: true, trim: true },
        inviteLink: { type: String, trim: true },
        repUserId: { type: String, required: true, index: true, trim: true },
        addedBy: { type: String, required: true },
    },
    { timestamps: true }
);

export const Partner = model<IPartner>("Partner", partnerSchema);
