export const AI_CONFIG = {
    enabled: process.env.AI_ENABLED === "true",
    apiKey: process.env.GROQ_API_KEY ?? "",
    model: process.env.AI_MODEL ?? "llama-3.3-70b-versatile",
    timeoutMs: Number(process.env.AI_TIMEOUT_MS) || 5_000,
    minMessageLength: Number(process.env.AI_MIN_MESSAGE_LENGTH) || 5,
    maxPromptLength: 800,
} as const;

export type MessageClassification =
    | "support_reply"
    | "low_effort_reply"
    | "staff_chat"
    | "spam"
    | "conversation_end"
    | "meaningful"
    | "unknown";

export interface AiClassificationResult {
    classification: MessageClassification;
    confidence: number;
    fallback: boolean;
}

export interface AiAnalysisResult {
    meaningful: boolean;
    confidence: number;
    fallback: boolean;
    reason?: string;
}
