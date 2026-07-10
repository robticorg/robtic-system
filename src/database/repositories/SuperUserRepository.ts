import { SuperUser, type ISuperUser } from "@database/models/SuperUser";

export class SuperUserRepository {
    static async isWhitelisted(userId: string): Promise<boolean> {
        const doc = await SuperUser.findOne({ userId });
        return !!doc;
    }

    static async add(userId: string, addedBy: string): Promise<ISuperUser> {
        return SuperUser.findOneAndUpdate(
            { userId },
            { $set: { addedBy } },
            { upsert: true, returnDocument: "after", new: true }
        ) as Promise<ISuperUser>;
    }

    static async remove(userId: string): Promise<void> {
        await SuperUser.deleteOne({ userId });
    }

    static async list(): Promise<ISuperUser[]> {
        return SuperUser.find();
    }
}
