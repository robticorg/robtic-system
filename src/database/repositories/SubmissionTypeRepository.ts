import { SubmissionType, type ISubmissionType, type ISubmissionQuestion } from "@database/models/SubmissionType";

const MAX_QUESTIONS = 5;
const MAX_QUESTION_LENGTH = 45;

const DEFAULT_SEED: {
    key: string;
    name: string;
    grantRoleIds: string[];
    managerRoleIds: string[];
    questions: string[];
}[] = [
    {
        key: "dev",
        name: "Dev",
        grantRoleIds: ["1479440691515097182"],
        managerRoleIds: ["1479427429264003082"],
        questions: [
            "What stack do you work with most?",
            "Share one project you built and your role.",
            "How many hours weekly can you commit?",
        ],
    },
    {
        key: "design",
        name: "Design",
        grantRoleIds: ["1479440693045891095"],
        managerRoleIds: ["1479427429792612352"],
        questions: [
            "What design tools do you use most?",
            "How do you handle feedback and revisions?",
            "How many hours weekly can you commit?",
        ],
    },
    {
        key: "moderation",
        name: "Moderation",
        grantRoleIds: ["1479440694018969721"],
        managerRoleIds: ["1479427433638920245"],
        questions: [
            "How do you handle rule violations fairly?",
            "How would you de-escalate a heated situation?",
            "How many hours weekly can you commit?",
        ],
    },
    {
        key: "community",
        name: "Community",
        grantRoleIds: ["1479440692639170814"],
        managerRoleIds: ["1479427430291869870"],
        questions: [
            "How would you keep the community engaged?",
            "What activity ideas would you run?",
            "How many hours weekly can you commit?",
        ],
    },
    {
        key: "events",
        name: "Events",
        grantRoleIds: ["1479440693528236092"],
        managerRoleIds: ["1479427432376307803"],
        questions: [
            "What event formats can you organize well?",
            "How would you increase event participation?",
            "How many hours weekly can you commit?",
        ],
    },
    {
        key: "support",
        name: "Support",
        grantRoleIds: ["1479440691082821675"],
        managerRoleIds: ["1479427432405536829"],
        questions: [
            "How do you approach helping confused users?",
            "How do you prioritize support requests?",
            "How many hours weekly can you commit?",
        ],
    },
    {
        key: "hr",
        name: "HR",
        grantRoleIds: ["1479443342759559179"],
        managerRoleIds: ["1479427436159697059"],
        questions: [
            "How would you evaluate staff applications?",
            "How do you resolve internal team conflicts?",
            "How many hours weekly can you commit?",
        ],
    },
];

function slugify(name: string): string {
    const slug = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return slug || "submission";
}

function clampQuestion(text: string): string {
    return text.slice(0, MAX_QUESTION_LENGTH);
}

export class SubmissionTypeRepository {
    static async ensureDefaults(guildId: string): Promise<void> {
        const existing = await SubmissionType.exists({ guildId });
        if (existing) return;

        await Promise.all(
            DEFAULT_SEED.map(seed =>
                SubmissionType.findOneAndUpdate(
                    { guildId, key: seed.key },
                    {
                        $setOnInsert: {
                            guildId,
                            key: seed.key,
                            name: seed.name,
                            grantRoleIds: seed.grantRoleIds,
                            managerRoleIds: seed.managerRoleIds,
                            questions: seed.questions.map((question, i) => ({
                                id: `q${i + 1}`,
                                question: clampQuestion(question),
                            })),
                            isOpen: false,
                        },
                    },
                    { upsert: true }
                )
            )
        );
    }

    static async list(guildId: string): Promise<ISubmissionType[]> {
        await this.ensureDefaults(guildId);
        return SubmissionType.find({ guildId }).sort({ name: 1 });
    }

    static async get(guildId: string, key: string): Promise<ISubmissionType | null> {
        return SubmissionType.findOne({ guildId, key });
    }

    static async findByName(guildId: string, name: string): Promise<ISubmissionType | null> {
        return SubmissionType.findOne({ guildId, name: new RegExp(`^${name.trim()}$`, "i") });
    }

    static async getOrCreate(guildId: string, name: string): Promise<{ type: ISubmissionType; created: boolean }> {
        await this.ensureDefaults(guildId);

        const existing = await this.findByName(guildId, name);
        if (existing) return { type: existing, created: false };

        const trimmedName = name.trim();
        let key = slugify(trimmedName);
        let suffix = 1;
        while (await SubmissionType.exists({ guildId, key })) {
            suffix += 1;
            key = `${slugify(trimmedName)}-${suffix}`;
        }

        const type = await SubmissionType.create({
            guildId,
            key,
            name: trimmedName,
            questions: [],
            grantRoleIds: [],
            managerRoleIds: [],
            isOpen: false,
        });

        return { type, created: true };
    }

    static async rename(guildId: string, key: string, name: string): Promise<ISubmissionType | null> {
        return SubmissionType.findOneAndUpdate(
            { guildId, key },
            { $set: { name: name.trim() } },
            { returnDocument: "after" }
        );
    }

    static async setGrantRoles(guildId: string, key: string, roleIds: string[]): Promise<ISubmissionType | null> {
        return SubmissionType.findOneAndUpdate(
            { guildId, key },
            { $set: { grantRoleIds: roleIds } },
            { returnDocument: "after" }
        );
    }

    static async setManagerRoles(guildId: string, key: string, roleIds: string[]): Promise<ISubmissionType | null> {
        return SubmissionType.findOneAndUpdate(
            { guildId, key },
            { $set: { managerRoleIds: roleIds } },
            { returnDocument: "after" }
        );
    }

    static async setQuestions(guildId: string, key: string, questions: string[]): Promise<ISubmissionType | null> {
        const trimmed: ISubmissionQuestion[] = questions
            .map(q => q.trim())
            .filter(Boolean)
            .slice(0, MAX_QUESTIONS)
            .map((question, i) => ({ id: `q${i + 1}`, question: clampQuestion(question) }));

        return SubmissionType.findOneAndUpdate(
            { guildId, key },
            { $set: { questions: trimmed } },
            { returnDocument: "after" }
        );
    }

    static async setOpen(guildId: string, key: string, isOpen: boolean): Promise<ISubmissionType | null> {
        return SubmissionType.findOneAndUpdate(
            { guildId, key },
            { $set: { isOpen } },
            { returnDocument: "after" }
        );
    }

    static async remove(guildId: string, key: string): Promise<ISubmissionType | null> {
        return SubmissionType.findOneAndDelete({ guildId, key });
    }
}

export { MAX_QUESTIONS, MAX_QUESTION_LENGTH };
