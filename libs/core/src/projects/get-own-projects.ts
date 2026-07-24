import type { OwnProjectEntry } from "@typings/project-share";
import { ProjectShareRepository, ProjectsRepository } from "@database/repositories";

/** The caller's pending and published projects, newest first, for the Activity's projects page. */
export async function getOwnProjects(userId: string): Promise<OwnProjectEntry[]> {
    const [pending, published] = await Promise.all([
        ProjectShareRepository.findPendingByUserId(userId),
        ProjectsRepository.findByUserId(userId),
    ]);

    const entries: OwnProjectEntry[] = [
        ...pending.map((project): OwnProjectEntry => ({
            projectId: project.projectId,
            title: project.projectTitle,
            description: project.projectDescription,
            projectType: project.projectType,
            status: "pending",
            likes: 0,
            dislikes: 0,
            views: 0,
            createdAt: project.createdAt.getTime(),
        })),
        ...published.map((project): OwnProjectEntry => ({
            projectId: project.projectId,
            title: project.projectTitle,
            description: project.projectDescription,
            projectType: project.projectType,
            status: "published",
            likes: project.likes.length,
            dislikes: project.dislikes.length,
            views: project.views,
            createdAt: project.createdAt.getTime(),
        })),
    ];

    return entries.sort((a, b) => b.createdAt - a.createdAt);
}
