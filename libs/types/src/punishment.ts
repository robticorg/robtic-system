export type PunishType = "warn" | "mute" | "ban";

/** Decoded payload of a punish proof/shortcut custom id. */
export interface PunishCustomIdParts {
    type: PunishType;
    guildId: string;
    targetId: string;
    reasonKey: string;
    moderatorId: string;
    extra: string;
}
