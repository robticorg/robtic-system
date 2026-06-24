import { PendingProject, type IPendingProject } from "@database/models/PendingProjectShare";
import { Project, type IProject, ProjectType } from "@database/models/ProjectShare";

type ProjectKindType = "web" | "discord" | "other";

interface PendingProjectCreateInput {
    userId: string;
    type: ProjectType;
    projectId: string;
    projectType: ProjectKindType;
    projectTitle: string;
    projectDescription: string;
    projectLinks: {
        github?: string;
        liveDemo?: string;
        other?: string;
    };
    youtubeTutorialLink?: string;
    envFileLink?: string;
    imageLink?: string;
}

interface PublishedProjectCreateInput extends PendingProjectCreateInput {
    likes?: string[];
    dislikes?: string[];
    views?: number;
}

export class ProjectShareRepository {
    static async createPending(data: PendingProjectCreateInput): Promise<IPendingProject> {
        return PendingProject.create(data);
    }

    static async findPendingById(pendingId: string): Promise<IPendingProject | null> {
        return PendingProject.findById(pendingId);
    }

    static async updatePendingById(pendingId: string, update: Record<string, unknown>): Promise<IPendingProject | null> {
        return PendingProject.findByIdAndUpdate(pendingId, update, { returnDocument: "after" });
    }

    static async savePending(project: IPendingProject): Promise<IPendingProject> {
        return project.save();
    }

    static async deletePendingById(pendingId: string): Promise<IPendingProject | null> {
        return PendingProject.findByIdAndDelete(pendingId);
    }

    static async createPublished(data: PublishedProjectCreateInput): Promise<IProject> {
        return Project.create({
            ...data,
            likes: data.likes ?? [],
            dislikes: data.dislikes ?? [],
            views: data.views ?? 0,
        });
    }

    static async createPublishedFromPending(project: IPendingProject): Promise<IProject> {
        return this.createPublished({
            userId: project.userId,
            type: project.type,
            projectId: project.projectId,
            projectType: project.projectType as ProjectKindType,
            projectTitle: project.projectTitle,
            projectDescription: project.projectDescription,
            projectLinks: project.projectLinks,
            youtubeTutorialLink: project.youtubeTutorialLink ?? undefined,
            envFileLink: project.envFileLink ?? undefined,
            imageLink: project.imageLink ?? undefined,
        });
    }

    static async findPublishedByType(type: ProjectType, limit = 10): Promise<IProject[]> {
        return Project.find({ type }).sort({ createdAt: -1 }).limit(limit);
    }

    static async findPublishedPage(
        type: ProjectType,
        page = 1,
        pageSize = 10,
        query = ""
    ): Promise<{ projects: IProject[]; total: number }> {
        const safePage = Math.max(1, page);
        const safeSize = Math.max(1, pageSize);
        const trimmedQuery = query.trim();

        const filter: Record<string, unknown> = { type };

        if (trimmedQuery.length > 0) {
            const escaped = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const regex = new RegExp(escaped, "i");
            filter.$or = [
                { projectTitle: regex },
                { projectDescription: regex },
                { projectId: regex },
            ];
        }

        const [projects, total] = await Promise.all([
            Project.find(filter)
                .sort({ createdAt: -1 })
                .skip((safePage - 1) * safeSize)
                .limit(safeSize),
            Project.countDocuments(filter),
        ]);

        return { projects, total };
    }

    static async findPublishedByProjectId(projectId: string): Promise<IProject | null> {
        return Project.findOne({ projectId });
    }

    static async setReaction(
        projectId: string,
        userId: string,
        reaction: "like" | "dislike"
    ): Promise<IProject | null> {
        if (reaction === "like") {
            return Project.findOneAndUpdate(
                { projectId },
                {
                    $addToSet: { likes: userId },
                    $pull: { dislikes: userId },
                },
                { returnDocument: "after" }
            );
        }

        return Project.findOneAndUpdate(
            { projectId },
            {
                $addToSet: { dislikes: userId },
                $pull: { likes: userId },
            },
            { returnDocument: "after" }
        );
    }
}