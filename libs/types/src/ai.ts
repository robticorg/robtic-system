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
