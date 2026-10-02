import { Schema, model, type Document } from "mongoose";

/**
 * A bot-wide image for this branch (this bot deployment), stored in MongoDB so it survives
 * redeploys and doesn't depend on a Discord attachment URL that expires. Keyed by purpose — `line`
 * is the separator image set with `/setline`.
 */
export interface IBranchAsset extends Document {
    key: string;
    data: Buffer;
    contentType: string;
    /** File name it is sent under, e.g. `line.png` — the extension matches the image type. */
    fileName: string;
    updatedBy: string;
    createdAt: Date;
    updatedAt: Date;
}

const branchAssetSchema = new Schema<IBranchAsset>(
    {
        key: { type: String, required: true, unique: true },
        data: { type: Buffer, required: true },
        contentType: { type: String, required: true },
        fileName: { type: String, required: true },
        updatedBy: { type: String, required: true },
    },
    { timestamps: true }
);

export const BranchAsset = model<IBranchAsset>("BranchAsset", branchAssetSchema);
