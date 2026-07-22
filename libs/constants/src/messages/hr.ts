/** Text for the submission-type configuration panel (/setup-submit). */
export const SUBMIT_CONFIG_MESSAGES = {
    panelTitle: (typeName: string) => `⚙️ Configuring: ${typeName}`,
    noneSet: "*None set*",
    noQuestions: "*No questions configured*",
    statusFieldName: "Status",
    statusOpen: "✅ Open",
    statusClosed: "🔒 Closed",
    grantRolesFieldName: "Grant Roles",
    managerRolesFieldName: "Manager Roles",
    questionsFieldName: "Questions (max 5)",
    keyFooter: (key: string) => `Key: ${key}`,

    renameButtonLabel: "Rename",
    editQuestionsButtonLabel: "Edit Questions",
    closeButtonLabel: "Close",
    openButtonLabel: "Open",
    deleteButtonLabel: "Delete",

    grantRolesPlaceholder: "Select roles to grant on acceptance",
    managerRolesPlaceholder: "Select manager roles who can accept/reject",

    deleteConfirmTitle: (typeName: string) => `⚠️ Delete "${typeName}"?`,
    deleteConfirmDescription: "This will permanently remove this submission type and its configuration. This cannot be undone.",
    deleteConfirmYesLabel: "Yes, delete it",
    deleteConfirmCancelLabel: "Cancel",
} as const;

/** Text for the public staff-applications panel. */
export const APPLY_PANEL_MESSAGES = {
    title: "📋 Staff Applications",
    closedDescription: "No submission types are currently open for applications.\nCheck back later!",
    openDescription: "Select a submission type below to apply.\nMake sure to read the requirements before applying.",
    typeFieldName: (name: string) => `📋 ${name}`,
    typeFieldValue: "✅ Open",
    selectPlaceholder: "Select where to apply...",
    typeEmoji: "📋",
} as const;

/** Text used during a live HR interview thread. */
export const INTERVIEW_MESSAGES = {
    endedManagerPrompt: (managerId: string) =>
        `<@${managerId}>, the interview has ended. Please take an action\n/interview accept\n/interview reject`,
    endedApplicantNotice: "The interview has ended, waiting for the manager to take action",
    managerAckReaction: "✅",
} as const;

/** Staff-tier band labels, mirroring the STAFF_TIER_THRESHOLDS score bands. */
export const STAFF_CATEGORY_LABELS = {
    owner: "Owner",
    lead: "Lead",
    highStaff: "High Staff",
    staff: "Staff",
    none: "—",
} as const;

/** Auto-managed `Warn N` role naming for staff warnings. */
export const STAFF_WARN_ROLE = {
    name: (level: number) => `Warn ${level}`,
    namePattern: /^Warn \d+$/,
    creationReason: "Auto-created staff warn-level role",
} as const;
