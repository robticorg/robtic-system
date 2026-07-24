import type { ProjectSubmissionInput } from "@typings/project-share";
import { createPendingMemberProject } from "@core/projects";
import { getDevGuildId } from "@core/bot-admin";
import { ProjectShareRepository } from "@database/repositories";
import { BRANCH_CONFIG } from "@config";
import { PROJECT_REVIEW_MESSAGES } from "@constants";
import { Logger } from "@logger";
import { authenticateRequest } from "../lib/authenticate-request";
import { discordBotPost } from "../lib/discord-api";
import { jsonError, API_ERRORS } from "../lib/json-response";

const REVIEW_EMBED_COLOR = 0xfee75c; // discord.js "Yellow"

/**
 * POST /api/projects {title, description, projectType, link?} — member project submission from
 * the Activity. Creates the same pending record as /project share and posts the same review
 * embed + Accept/Refuse buttons to the dev review channel, so the bot's existing
 * review_accept_/review_refuse_ handlers pick it up unchanged.
 */
export async function submitProjectRoute(request: Request): Promise<Response> {
    const viewer = await authenticateRequest(request);
    if (!viewer) return jsonError(API_ERRORS.unauthorized, 401);

    const body = await request.json().catch(() => null) as (ProjectSubmissionInput & { guildId?: string }) | null;
    if (!body || typeof body !== "object") return jsonError("A JSON body is required", 400);

    // Project sharing only exists inside the configured dev server (mirrors the hidden tab).
    const devGuildId = await getDevGuildId();
    if (!devGuildId || body.guildId !== devGuildId) {
        return jsonError("Project sharing is only available in the dev server", 403);
    }

    const result = await createPendingMemberProject(viewer.id, body);
    if ("error" in result) return jsonError(result.error, 400);

    const { pending } = result;
    const none = PROJECT_REVIEW_MESSAGES.noneValue;

    const posted = await discordBotPost(`/channels/${BRANCH_CONFIG.channels.devProjectReview}/messages`, {
        content: PROJECT_REVIEW_MESSAGES.submissionNotice(viewer.id),
        embeds: [{
            title: PROJECT_REVIEW_MESSAGES.submissionEmbedTitle,
            description: PROJECT_REVIEW_MESSAGES.submissionEmbedDescription(
                viewer.id,
                pending.projectTitle,
                pending.projectDescription,
                pending.projectLinks.github || none,
                pending.projectLinks.other || none,
                none,
                none,
            ),
            color: REVIEW_EMBED_COLOR,
        }],
        components: [{
            type: 1,
            components: [
                { type: 2, style: 3, label: PROJECT_REVIEW_MESSAGES.acceptButtonLabel, custom_id: `review_accept_${pending._id}` },
                { type: 2, style: 4, label: PROJECT_REVIEW_MESSAGES.refuseButtonLabel, custom_id: `review_refuse_${pending._id}` },
            ],
        }],
    });

    if (!posted) {
        // Without the review post nobody would ever see the submission — roll it back.
        await ProjectShareRepository.deletePendingById(pending._id.toString()).catch(() => null);
        Logger.error(`Failed to post project review message for ${viewer.id}`, "api");
        return jsonError(PROJECT_REVIEW_MESSAGES.reviewSendError, 502);
    }

    return Response.json({ ok: true, projectId: pending.projectId });
}
