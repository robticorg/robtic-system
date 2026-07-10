import { Schema, model, type Document } from "mongoose";

export interface ISuperUser extends Document {
    userId: string;
    addedBy: string;
    createdAt: Date;
    updatedAt: Date;
}

const superUserSchema = new Schema<ISuperUser>(
    {
        userId: { type: String, required: true, unique: true },
        addedBy: { type: String, required: true },
    },
    { timestamps: true }
);

export const SuperUser = model<ISuperUser>("SuperUser", superUserSchema);
