import type { ProjectSubmissionInput } from "@typings/project-share";
import type { IPendingProject } from "@database/models/PendingProjectShare";
import { ProjectType } from "@database/models/ProjectShare";
import { ProjectShareRepository } from "@database/repositories";
import { GENERIC_URL_REGEX, PROJECT_ID_LENGTH, PROJECT_INPUT_LIMITS } from "@constants";
import { normalizeProjectType } from "./normalize-project-type";

/**
 * Validates and stores a member project submission coming from a surface without a modal
 * (the Activity). Mirrors the /project share modal's limits; invalid links are dropped,
 * out-of-range text is rejected with a human-readable error.
 */
export async function createPendingMemberProject(
    userId: string,
    input: ProjectSubmissionInput,
): Promise<{ pending: IPendingProject } | { error: string }> {
    const title = input.title?.trim() ?? "";
    const description = input.description?.trim() ?? "";
    const { shortMin, shortMax, paragraphMin, paragraphMax } = PROJECT_INPUT_LIMITS;

    if (title.length < shortMin || title.length > shortMax) {
        return { error: `Title must be ${shortMin}-${shortMax} characters.` };
    }
    if (description.length < paragraphMin || description.length > paragraphMax) {
        return { error: `Description must be ${paragraphMin}-${paragraphMax} characters.` };
    }

    let link = input.link?.trim() ?? "";
    if (link && !GENERIC_URL_REGEX.test(link)) {
        link = "";
    }

    const pending = await ProjectShareRepository.createPending({
        userId,
        type: ProjectType.Member,
        projectId: Math.random().toString(36).substring(2, 2 + PROJECT_ID_LENGTH),
        projectType: normalizeProjectType(input.projectType ?? "other"),
        projectTitle: title,
        projectDescription: description,
        projectLinks: {
            github: link.includes("github.com") ? link : undefined,
            other: !link.includes("github.com") && link ? link : undefined,
        },
    });

    return { pending };
}
