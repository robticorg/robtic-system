import { BranchAsset, type IBranchAsset } from "@database/models/BranchAsset";

export class BranchAssetRepository {
    static async get(key: string): Promise<IBranchAsset | null> {
        return BranchAsset.findOne({ key });
    }

    static async set(key: string, asset: { data: Buffer; contentType: string; fileName: string; updatedBy: string }): Promise<void> {
        await BranchAsset.updateOne({ key }, { $set: asset }, { upsert: true });
    }

    /** Returns whether one existed. */
    static async delete(key: string): Promise<boolean> {
        const result = await BranchAsset.deleteOne({ key });
        return result.deletedCount > 0;
    }
}
