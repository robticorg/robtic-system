import { Membership, type IMembership } from "@database/models/Membership";

export class MembershipRepository {
    static async findByUser(discordId: string, guildId: string): Promise<IMembership | null> {
        return Membership.findOne({ discordId, guildId });
    }

    static async create(data: Partial<IMembership>): Promise<IMembership> {
        return Membership.create(data);
    }

    static async deactivate(discordId: string, guildId: string): Promise<IMembership | null> {
        return Membership.findOneAndUpdate(
            { discordId, guildId },
            { active: false, endDate: new Date() },
            { returnDocument: "after" }
        );
    }

    static async findExpired(): Promise<IMembership[]> {
        return Membership.find({
            active: true,
            endDate: { $lte: new Date() },
        });
    }

    static async findAllActive(guildId: string): Promise<IMembership[]> {
        return Membership.find({ guildId, active: true });
    }
}
