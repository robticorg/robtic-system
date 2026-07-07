import { AdOrder, type IAdOrder, type IAdOrderItem } from "@database/models/AdOrder";

export class AdOrderRepository {
    static async create(guildId: string, userId: string, items: IAdOrderItem[], totalUsd: number): Promise<IAdOrder> {
        return AdOrder.create({ guildId, userId, items, totalUsd });
    }

    static async get(guildId: string, orderId: string): Promise<IAdOrder | null> {
        return AdOrder.findOne({ _id: orderId, guildId });
    }

    static async setReviewMessage(orderId: string, messageId: string): Promise<IAdOrder | null> {
        return AdOrder.findByIdAndUpdate(orderId, { $set: { reviewMessageId: messageId } }, { returnDocument: "after" });
    }

    static async decide(orderId: string, status: "approved" | "rejected", decidedBy: string): Promise<IAdOrder | null> {
        return AdOrder.findByIdAndUpdate(
            orderId,
            { $set: { status, decidedBy, decidedAt: new Date() } },
            { returnDocument: "after" }
        );
    }
}
