/** Runtime AI (Groq) configuration, driven by environment variables. */
export const AI_CONFIG = {
    enabled: process.env.AI_ENABLED === "true",
    apiKey: process.env.GROQ_API_KEY ?? "",
    model: process.env.AI_MODEL ?? "llama-3.3-70b-versatile",
    timeoutMs: Number(process.env.AI_TIMEOUT_MS) || 5_000,
    minMessageLength: Number(process.env.AI_MIN_MESSAGE_LENGTH) || 5,
    maxPromptLength: 800,
} as const;
