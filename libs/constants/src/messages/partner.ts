/** Text for the partner explore list and detail views. */
export const PARTNER_MESSAGES = {
    listTitle: "🤝 Robtic Partners",
    listDescription: "Explore the communities we've partnered with. Pick one below to learn more.",
    emptyDescription: "There are no partner servers listed yet.",
    selectPlaceholder: "Select a partner to explore",
    detailTitle: (name: string) => `🤝 ${name}`,
    joinButtonLabel: "Join Server",
    backButtonLabel: "⬅ Back to list",
} as const;

/** Auto-managed `Streak N` role naming. */
export const STREAK_ROLE = {
    name: (level: number) => `Streak ${level}`,
    namePattern: /^Streak (\d+)$/i,
    creationReason: "Auto-created streak role",
    /** `fire<min>-<max>.png` icon files under images/streak. */
    iconFilenamePattern: /^fire(\d+)-(\d+)\.png$/i,
    iconsDirectory: ["images", "streak"] as const,
} as const;
