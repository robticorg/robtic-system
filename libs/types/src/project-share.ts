/** What a member fills in when sharing a project from the Activity. */
export interface ProjectSubmissionInput {
    title: string;
    description: string;
    /** Free-form; normalized onto PROJECT_TYPE_OPTIONS server-side. */
    projectType: string;
    /** Optional URL; dropped when it fails validation. */
    link?: string;
}

/** One of the caller's own projects, pending or published, listed in the Activity. */
export interface OwnProjectEntry {
    /** Public project id once published; pending submissions use their draft id. */
    projectId: string;
    title: string;
    description: string;
    projectType: string;
    status: "pending" | "published";
    likes: number;
    dislikes: number;
    views: number;
    /** Unix ms. */
    createdAt: number;
}
