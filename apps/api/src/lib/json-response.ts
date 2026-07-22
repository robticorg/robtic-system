export function jsonError(message: string, status: number): Response {
    return Response.json({ error: message }, { status });
}

export const API_ERRORS = {
    unauthorized: "Unauthorized — a valid Discord access token is required",
    guildRequired: "guildId is required",
    userRequired: "userId is required",
    notFound: "Not Found",
    serverError: "Internal server error",
} as const;
