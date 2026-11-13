import { bilingual } from "@utils/lang-context";

/** Text for security-threshold alerts and their audit mirror. */
export const SECURITY_MESSAGES = bilingual({
    alertTitle: "🚨 Security limit reached",
    auditTitle: "🛡️ Security alert",
    auditDescription: (executorId: string, event: string, count: number, limit: number, window: string) =>
        `<@${executorId}> hit a security rule for **${event}** (${count}/${limit} in ${window}).`,

    executorFieldName: "By",
    eventFieldName: "Event",
    countFieldName: "Count",
    windowFieldName: "Window",
    actionsFieldName: "Actions",
    actionResultsFieldName: "Action results",
    resultsFieldName: "Results",
    lastTargetFieldName: "Last target",
    sourceFieldName: "Source",
    detailsFieldName: "Details",
    noneValue: "none",

    thresholdReason: "Security limit exceeded",
    emptyContent: "(empty)",
    noReasonProvided: "No reason given",
}, {
    alertTitle: "🚨 تم تجاوز حد الحماية",
    auditTitle: "🛡️ تنبيه حماية",
    auditDescription: (executorId: string, event: string, count: number, limit: number, window: string) =>
        `<@${executorId}> تجاوز حد الحماية في **${event}** (${count}/${limit} خلال ${window}).`,

    executorFieldName: "بواسطة",
    eventFieldName: "الحدث",
    countFieldName: "العدد",
    windowFieldName: "المدة",
    actionsFieldName: "الإجراءات",
    actionResultsFieldName: "نتائج الإجراءات",
    resultsFieldName: "النتائج",
    lastTargetFieldName: "آخر هدف",
    sourceFieldName: "المصدر",
    detailsFieldName: "التفاصيل",
    noneValue: "لا يوجد",

    thresholdReason: "تجاوز حد الحماية",
    emptyContent: "(فارغ)",
    noReasonProvided: "بدون سبب",
});
