/** Text for security-threshold alerts and their audit mirror. */
export const SECURITY_MESSAGES = {
    alertTitle: "🚨 Security Threshold Triggered",
    auditTitle: "🛡️ Security Alert (Audit)",
    auditDescription: (executorId: string, event: string, count: number, limit: number, window: string) =>
        `User <@${executorId}> triggered a security rule for **${event}** (${count}/${limit} in ${window}).`,

    executorFieldName: "Executor",
    eventFieldName: "Event",
    countFieldName: "Count",
    windowFieldName: "Window",
    actionsFieldName: "Actions",
    actionResultsFieldName: "Action Results",
    resultsFieldName: "Results",
    lastTargetFieldName: "Last Target",
    sourceFieldName: "Source",
    detailsFieldName: "Details",
    noneValue: "none",

    thresholdReason: "Security threshold exceeded",
    emptyContent: "(empty)",
    noReasonProvided: "No reason provided",
} as const;
