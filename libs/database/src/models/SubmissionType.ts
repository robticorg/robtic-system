import { Document, model, Schema } from "mongoose";

export interface ISubmissionQuestion {
    id: string;
    question: string;
}

export interface ISubmissionType extends Document {
    guildId: string;
    key: string;
    name: string;
    questions: ISubmissionQuestion[];
    grantRoleIds: string[];
    managerRoleIds: string[];
    isOpen: boolean;
    createdAt: Date;
}

const SubmissionQuestionSchema = new Schema<ISubmissionQuestion>(
    {
        id: { type: String, required: true },
        question: { type: String, required: true, maxlength: 45 },
    },
    { _id: false }
);

const SubmissionTypeSchema = new Schema<ISubmissionType>({
    guildId: { type: String, required: true },
    key: { type: String, required: true },
    name: { type: String, required: true },
    questions: { type: [SubmissionQuestionSchema], default: [] },
    grantRoleIds: { type: [String], default: [] },
    managerRoleIds: { type: [String], default: [] },
    isOpen: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
});

SubmissionTypeSchema.index({ guildId: 1, key: 1 }, { unique: true });

export const SubmissionType = model<ISubmissionType>("SubmissionType", SubmissionTypeSchema);
