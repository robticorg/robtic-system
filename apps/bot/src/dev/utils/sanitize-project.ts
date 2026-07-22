import { GENERIC_URL_REGEX, YOUTUBE_URL_REGEX, PROJECT_TYPE_OPTIONS } from "@constants";

type SanitizableProject = {
    projectType: string;
    projectLinks: { github?: string; other?: string; liveDemo?: string };
    youtubeTutorialLink?: string;
};

export type ProjectKind = typeof PROJECT_TYPE_OPTIONS[number];

/** Normalizes a legacy/free-form project type onto one of PROJECT_TYPE_OPTIONS. */
export function normalizeProjectType(raw: string): ProjectKind {
    const lowered = raw.toLowerCase();
    if (lowered.startsWith("w")) return "web";
    if (lowered.startsWith("d")) return "discord";
    if ((PROJECT_TYPE_OPTIONS as readonly string[]).includes(lowered)) return lowered as ProjectKind;
    return "other";
}

/** Drops any stored link that no longer passes validation, so old records can't render bad URLs. */
export function sanitizeProject(project: SanitizableProject): void {
    project.projectType = normalizeProjectType(project.projectType);

    if (project.projectLinks.github && !GENERIC_URL_REGEX.test(project.projectLinks.github)) project.projectLinks.github = undefined;
    if (project.projectLinks.other && !GENERIC_URL_REGEX.test(project.projectLinks.other)) project.projectLinks.other = undefined;
    if (project.projectLinks.liveDemo && !GENERIC_URL_REGEX.test(project.projectLinks.liveDemo)) project.projectLinks.liveDemo = undefined;
    if (project.youtubeTutorialLink && !YOUTUBE_URL_REGEX.test(project.youtubeTutorialLink)) project.youtubeTutorialLink = undefined;
}
