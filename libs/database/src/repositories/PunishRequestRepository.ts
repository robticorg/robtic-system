import { Types } from "mongoose";
import { PunishRequest, type IPunishRequest } from "@database/models/PunishRequest";

const KEEP_MS = 30 * 86_400_000;

type NewRequest = Pick<IPunishRequest, "guildId" | "type" | "targetId" | "reasonKey" | "moderatorId" | "extra" | "status"> & { proofUrl?: string | null };

export class PunishRequestRepository {
    static async create(data: NewRequest): Promise<string> {
        const row = await PunishRequest.create({ ...data, proofUrl: data.proofUrl ?? null, expiresAt: new Date(Date.now() + KEEP_MS) });
        return String(row._id);
    }

    static async get(id: string): Promise<IPunishRequest | null> {
        return Types.ObjectId.isValid(id) ? PunishRequest.findById(id) : null;
    }

    /** Moves a request from one status to another, only if it is still in the first: true for exactly one caller. */
    static async claim(id: string, from: IPunishRequest["status"], to: IPunishRequest["status"], by: string | null = null, patch: Partial<IPunishRequest> = {}): Promise<IPunishRequest | null> {
        if (!Types.ObjectId.isValid(id)) return null;
        return PunishRequest.findOneAndUpdate({ _id: id, status: from }, { $set: { ...patch, status: to, decidedBy: by } }, { returnDocument: "after" });
    }
}
