export interface ProjectSubmission {
    title: string;
    description: string;
    projectType: string;
    link?: string;
}

export interface OwnProject {
    projectId: string;
    title: string;
    description: string;
    projectType: string;
    status: "pending" | "published";
    likes: number;
    dislikes: number;
    views: number;
    createdAt: number;
}
