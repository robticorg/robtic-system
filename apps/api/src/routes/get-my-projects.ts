import { getOwnProjects } from "@core/projects";
import { authenticateRequest } from "../lib/authenticate-request";
import { jsonError, API_ERRORS } from "../lib/json-response";

/** GET /api/projects/mine — the caller's pending and published projects, newest first. */
export async function getMyProjectsRoute(request: Request): Promise<Response> {
    const viewer = await authenticateRequest(request);
    if (!viewer) return jsonError(API_ERRORS.unauthorized, 401);

    return Response.json({ projects: await getOwnProjects(viewer.id) });
}
