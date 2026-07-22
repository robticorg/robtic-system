import { BRANCH_CONFIG } from "@config";

const PUNISHMENT_ROLE_IDS = BRANCH_CONFIG.roles.memberPunishments;
const STAFF_PUNISHMENT_ROLE_IDS = BRANCH_CONFIG.roles.staffPunishments;

/** Member punishment ladder: role id, display name, and severity level (0-100). */
export const MEMBER_PUNISHMENTS = {
    warn: {
        id: PUNISHMENT_ROLE_IDS.warn,
        name: "Warning",
        level: 20,
    },
    fWarn: {
        id: PUNISHMENT_ROLE_IDS.fWarn,
        name: "Final Warning",
        level: 40,
    },
    tempMute: {
        id: PUNISHMENT_ROLE_IDS.tempMute,
        name: "Temporary Mute",
        level: 60,
    },
    tempBan: {
        id: PUNISHMENT_ROLE_IDS.tempBan,
        name: "Temporary Ban",
        level: 80,
    },
    permBan: {
        id: PUNISHMENT_ROLE_IDS.permBan,
        name: "Permanent Ban",
        level: 100,
    },
} as const;

/** Points added to a user's punishment score per action type. */
export const PUNISHMENT_POINTS = {
    warn: 5,
    mute: 10,
    ban: 20,
} as const;

/** Staff punishment ladder, ordered from lightest to heaviest. */
export const STAFF_PUNISHMENTS = [
    {
        id: STAFF_PUNISHMENT_ROLE_IDS[0],
        name: "Staff Reminder",
    },
    {
        id: STAFF_PUNISHMENT_ROLE_IDS[1],
        name: "Internal Warning",
    },
    {
        id: STAFF_PUNISHMENT_ROLE_IDS[2],
        name: "Performance Review",
    },
    {
        id: STAFF_PUNISHMENT_ROLE_IDS[3],
        name: "Rank Demotion",
    },
    {
        id: STAFF_PUNISHMENT_ROLE_IDS[4],
        name: "Staff Removal",
    },
] as const;
