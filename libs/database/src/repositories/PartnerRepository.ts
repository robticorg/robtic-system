import { Partner, type IPartner } from "@database/models/Partner";

export class PartnerRepository {
    static async create(data: {
        partnerServerId: string;
        partnerServerName: string;
        description: string;
        inviteLink?: string;
        repUserId: string;
        addedBy: string;
    }): Promise<IPartner> {
        return Partner.create(data);
    }

    static async findByServerId(partnerServerId: string): Promise<IPartner | null> {
        return Partner.findOne({ partnerServerId });
    }

    static async findByRepUserId(repUserId: string): Promise<IPartner | null> {
        return Partner.findOne({ repUserId });
    }

    static async deleteByServerId(partnerServerId: string): Promise<IPartner | null> {
        return Partner.findOneAndDelete({ partnerServerId });
    }

    static async getAll(): Promise<IPartner[]> {
        return Partner.find().sort({ createdAt: 1 });
    }
}
