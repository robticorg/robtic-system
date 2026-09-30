import { isValidObjectId } from "mongoose";
import { ReferralCode, type IReferralCode } from "@database/models/ReferralCode";

export class ReferralCodeRepository {
    /** Creates a code. Returns `null` when the guild already has one with that name. */
    static async create(entry: {
        guildId: string;
        code: string;
        ownerId: string;
        bonusBp: number;
        createdBy: string;
    }): Promise<IReferralCode | null> {
        try {
            return await ReferralCode.create({ ...entry, active: true });
        } catch (err) {
            if ((err as { code?: number }).code === 11000) return null;
            throw err;
        }
    }

    static async findByCode(guildId: string, code: string): Promise<IReferralCode | null> {
        return ReferralCode.findOne({ guildId, code });
    }

    /** `null` for an id that isn't one, or a code that was deleted. */
    static async findById(guildId: string, id: string): Promise<IReferralCode | null> {
        if (!isValidObjectId(id)) return null;
        return ReferralCode.findOne({ _id: id, guildId });
    }

    static async update(
        guildId: string,
        code: string,
        changes: Partial<Pick<IReferralCode, "active" | "bonusBp" | "ownerId">>,
    ): Promise<IReferralCode | null> {
        return ReferralCode.findOneAndUpdate({ guildId, code }, { $set: changes }, { returnDocument: "after" });
    }

    static async delete(guildId: string, code: string): Promise<IReferralCode | null> {
        return ReferralCode.findOneAndDelete({ guildId, code });
    }

    /** Every code in the guild, alphabetical. */
    static async list(guildId: string): Promise<IReferralCode[]> {
        return ReferralCode.find({ guildId }).sort({ code: 1 });
    }
}
