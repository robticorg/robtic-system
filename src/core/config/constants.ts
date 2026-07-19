import type { PermissionResolvable } from "discord.js";
import { BRANCH_CONFIG } from "./branch";

export const STAFF_TEAM_ROLE_ID = BRANCH_CONFIG.roles.staffTeam;
export const FULL_POWER_ROLE_IDS: string[] = BRANCH_CONFIG.roles.fullPower;
/** Only this user may add/remove entries in the super user whitelist (/whitelist). */
export const SUPER_ADMIN_ID = BRANCH_CONFIG.roles.superAdmin;

/** Fallback prefix for main-bot text commands when a guild hasn't set its own via /set-prefix. */
export const DEFAULT_PREFIX = "!";

export const SUPPORTED_LANGUAGES = {
    en: {
        id: BRANCH_CONFIG.roles.lang.en,
        name: "English"
    },
    ar: {
        id: BRANCH_CONFIG.roles.lang.ar,
        name: "Arabic"
    }
} as const;

const ROLE_IDS = BRANCH_CONFIG.roles.permissionMap;

export const ROLE_MAP: Record<
    PermissionLevel,
    { ids: string[]; names: string[]; perms: PermissionResolvable[]; department?: Department }
> = {
    Owner: {
        ids: [...ROLE_IDS.Owner],
        names: ["Owner", "CEO"],
        perms: ["Administrator"],
    },

    LeadDev: {
        ids: [...ROLE_IDS.LeadDev],
        names: ["Lead Developer"],
        perms: ["Administrator"],
        department: "Dev",
    },
    LeadDesign: {
        ids: [...ROLE_IDS.LeadDesign],
        names: ["Lead Designer"],
        perms: ["Administrator"],
        department: "Design",
    },
    LeadModerator: {
        ids: [...ROLE_IDS.LeadModerator],
        names: ["Lead Moderator"],
        perms: ["Administrator"],
        department: "Moderation",
    },
    LeadCommunity: {
        ids: [...ROLE_IDS.LeadCommunity],
        names: ["Lead Community Manager"],
        perms: ["Administrator"],
        department: "Community",
    },
    LeadSupport: {
        ids: [...ROLE_IDS.LeadSupport],
        names: ["Lead Support Manager"],
        perms: ["Administrator"],
        department: "Support",
    },

    StaffLead: {
        ids: [...ROLE_IDS.StaffLead],
        names: ["Staff Lead [ L ]"],
        perms: ["ManageGuild", "ManageChannels", "ManageRoles"],
    },
    SeniorStaffLead: {
        ids: [...ROLE_IDS.SeniorStaffLead],
        names: ["Senior Staff Lead [ L ]"],
        perms: ["ManageGuild", "ManageChannels"],
    },
    PrincipalStaff: {
        ids: [...ROLE_IDS.PrincipalStaff],
        names: ["Principal Staff [ L ]"],
        perms: ["ManageGuild"],
    },

    DevManager: {
        ids: [...ROLE_IDS.DevManager],
        names: ["Development Manager"],
        perms: ["ManageGuild", "ManageChannels"],
        department: "Dev",
    },
    DesignManager: {
        ids: [...ROLE_IDS.DesignManager],
        names: ["Design Manager"],
        perms: ["ManageGuild", "ManageChannels"],
        department: "Design",
    },
    CommunityManager: {
        ids: [...ROLE_IDS.CommunityManager],
        names: ["Community Manager"],
        perms: ["ManageGuild", "ManageChannels"],
        department: "Community",
    },
    EventManager: {
        ids: [...ROLE_IDS.EventManager],
        names: ["Events Manager"],
        perms: ["ManageGuild", "ManageChannels"],
        department: "Events",
    },
    SupportManager: {
        ids: [...ROLE_IDS.SupportManager],
        names: ["Support Manager"],
        perms: ["ManageGuild", "ManageRoles"],
        department: "Support",
    },
    ModerationManager: {
        ids: [...ROLE_IDS.ModerationManager],
        names: ["Moderation Manager"],
        perms: ["KickMembers", "BanMembers", "ModerateMembers"],
        department: "Moderation",
    },
    HRManager: {
        ids: [...ROLE_IDS.HRManager],
        names: ["HR Manager"],
        perms: ["ManageRoles"],
        department: "HR",
    },
    ContentManager: {
        ids: [...ROLE_IDS.ContentManager],
        names: ["Content Manager"],
        perms: ["ManageMessages", "ManageChannels"],
        department: "Community",
    },
    OperationManager: {
        ids: [...ROLE_IDS.OperationManager],
        names: ["Operations Manager"],
        perms: ["ManageGuild"],
        department: "Moderation",
    },

    Expert: {
        ids: [...ROLE_IDS.Expert],
        names: ["Expert I", "Expert II", "Expert III", "Expert IV", "Expert V"],
        perms: ["ManageMessages", "KickMembers"],
    },
    Professional: {
        ids: [...ROLE_IDS.Professional],
        names: ["Professional I", "Professional II", "Professional III", "Professional IV", "Professional V"],
        perms: ["ManageMessages"],
    },
    Associate: {
        ids: [...ROLE_IDS.Associate],
        names: ["Associate I", "Associate II", "Associate III", "Associate IV", "Associate V"],
        perms: ["ManageMessages"],
    },

    Member: {
        ids: [...ROLE_IDS.Member],
        names: [],
        perms: [],
    },
};

export const PERMISSION_HIERARCHY: Record<string, number> = {
    Owner: 100,

    LeadDev: 90,
    LeadDesign: 90,
    LeadModerator: 90,
    LeadCommunity: 90,
    LeadSupport: 90,

    StaffLead: 87,
    SeniorStaffLead: 85,
    PrincipalStaff: 83,

    DevManager: 80,
    DesignManager: 80,
    CommunityManager: 80,
    EventManager: 80,
    SupportManager: 80,
    ModerationManager: 80,
    HRManager: 80,
    ContentManager: 80,
    OperationManager: 80,

    Expert: 60,
    Professional: 40,
    Associate: 20,

    Member: 0,
};

export const LEAD_MANAGER_MAP: Record<string, PermissionLevel[]> = {
    LeadDev: ["DevManager"],
    LeadDesign: ["DesignManager"],
    LeadModerator: ["OperationManager", "ModerationManager"],
    LeadCommunity: ["CommunityManager", "ContentManager", "EventManager"],
    LeadSupport: ["HRManager", "SupportManager"],
};

export const MANAGER_DEPARTMENT_MAP: Record<string, Department> = {
    DevManager: "Dev",
    DesignManager: "Design",
    CommunityManager: "Community",
    EventManager: "Events",
    SupportManager: "Support",
    ModerationManager: "Moderation",
    HRManager: "HR",
    ContentManager: "Community",
    OperationManager: "Moderation",
};

export const DEPARTMENT_ROLES: Record<Department, string[]> = {
    Dev: ["Development Department"],
    Design: ["Design Department"],
    Moderation: ["Moderation Department"],
    Community: ["Community Department"],
    Events: ["Events Department"],
    Support: ["Support Department"],
    HR: ["HR Department"],
};

export const Colors = {
    default: 0x5865F2,
    success: 0x4CAF50,
    error: 0xFF4C4C,
    info: 0x3498DB,
    warning: 0xFFC107,
    moderation: 0xE74C3C,
    ticket: 0x9B59B6,
    hr: 0xF39C12,
    activity: 0x2ECC71,
} as const;

export type ColorKey = keyof typeof Colors;

const PUNISHMENT_ROLE_IDS = BRANCH_CONFIG.roles.memberPunishments;
const STAFF_PUNISHMENT_ROLE_IDS = BRANCH_CONFIG.roles.staffPunishments;

export const MembersPunishments = {
    warn: {
        id: PUNISHMENT_ROLE_IDS.warn,
        name: "Warning",
        level: 20,
    },
    fWarn: {
        id: PUNISHMENT_ROLE_IDS.fWarn,
        name: "Final Warning",
        level: 40
    },
    tempMute: {
        id: PUNISHMENT_ROLE_IDS.tempMute,
        name: "Temporary Mute",
        level: 60
    },
    tempBan: {
        id: PUNISHMENT_ROLE_IDS.tempBan,
        name: "Temporary Ban",
        level: 80
    },
    permBan: {
        id: PUNISHMENT_ROLE_IDS.permBan,
        name: "Permanent Ban",
        level: 100
    }
}

export const PunishmentsSystem = {
    warn: 5,
    mute: 10,
    ban: 20
}

export const StaffPunishments = [
    {
        id: STAFF_PUNISHMENT_ROLE_IDS[0],
        name: "Staff Reminder",
    },
    {
        id: STAFF_PUNISHMENT_ROLE_IDS[1],
        name: "Internal Warning"
    },
    {
        id: STAFF_PUNISHMENT_ROLE_IDS[2],
        name: "Performance Review"
    },
    {
        id: STAFF_PUNISHMENT_ROLE_IDS[3],
        name: "Rank Demotion"
    },
    {
        id: STAFF_PUNISHMENT_ROLE_IDS[4],
        name: "Staff Removal"
    },
]

export const XP_CONFIG = {
    minPerMessage: 5,
    maxPerMessage: 15,
    cooldownMs: 60_000,
    /** XP cost of level 1. Each subsequent level costs levelGrowthRate times the previous level's cost. */
    levelBaseXP: 100,
    levelGrowthRate: 1.2,
} as const;

/** Gate for the "real message" counter (/top Messages, ActivityXP.realMessageCount) — counts everywhere, not just XP channels. */
export const MESSAGE_STATS_CONFIG = {
    minMessageLength: 5,
} as const;

export const STAFF_POINTS = {
    publicChatPerMessage: 1,
    staffChatPerMessage: 1,
    maxPublicPerHour: 5,
    maxStaffPerHour: 2,
} as const;

export const SUPPORT_POINTS = {
    fastResponseMs: 60_000,
    fastResponsePoints: 5,
    normalResponseMs: 300_000,
    normalResponsePoints: 3,
    slowResponseMs: 900_000,
    slowResponsePoints: 1,
    noResponsePenalty: -2,
    claimAbandonPenalty: -3,
} as const;

export const DECAY_CONFIG = {
    inactiveDaysThreshold: 7,
    baseXPLoss: 10,
    accelerationPerDay: 5,
    maxDailyLoss: 100,
    checkIntervalMs: 3_600_000,
} as const;

export const STREAK_CONFIG = {
    claimWindowMs: 24 * 60 * 60 * 1000,
    expireWindowMs: 48 * 60 * 60 * 1000,
    reminderThresholdMs: 2 * 60 * 60 * 1000,
    recoveryWindowMs: 3 * 24 * 60 * 60 * 1000,
    minMessageLength: 5,
    autoDeleteMs: 10_000,
    duplicateWindowMs: 10_000,
    checkIntervalMs: 15 * 60 * 1000,
} as const;

/** Named score tiers for the Combo System. Ordered ascending; must stay sorted for level lookups to work. */
export const COMBO_LEVELS = [
    { name: "Bronze", minScore: 0 },
    { name: "Silver", minScore: 30 },
    { name: "Gold", minScore: 70 },
    { name: "Diamond", minScore: 140 },
    { name: "Legendary", minScore: 260 },
] as const;

export type ComboLevelName = typeof COMBO_LEVELS[number]["name"];

export const COMBO_CONFIG = {
    /** A combo expires after this long without a qualifying interaction between the pair. */
    expireMs: 2 * 60 * 1000,
    /** Periodic sweep interval: expiry, heat decay, leaderboard snapshots, champion role sync. */
    scanIntervalMs: 30_000,
    /** Heat halves roughly every this many ms of silence. */
    heatHalfLifeMs: 45_000,
    heatGainAlternating: 16,
    heatGainSame: 6,
    minMessageLength: 4,
    minScorePerMessage: 3,
    maxScorePerMessage: 12,
    /** Minimum combined confidence for the conversation detector to attribute a message to a partner. */
    detectionConfidenceThreshold: 0.3,
    /** Signals older than this are no longer considered for detection (mirrors the combo expiry window). */
    detectionWindowMs: 2 * 60 * 1000,
    /** Per-channel in-memory ring buffer size used for alternation/recency detection. */
    recentBufferSize: 12,
    /** How long an untouched channel's detection buffer is kept before being pruned. */
    channelBufferTtlMs: 10 * 60 * 1000,
    historyPageSize: 10,
    leaderboardLimit: 10,
    /** Cap on distinct partners tracked per user for Favorite Partner, to bound document growth. */
    maxTrackedPartners: 25,
    /** Punishment-level (0-100, see PunishmentRepository) at/above which a message author's combo score gain is dampened. */
    punishmentGateThreshold: 50,
    /** Multiplier applied to scoreGain once punishmentGateThreshold is met — dampened, not zeroed. */
    punishmentGateMultiplier: 0.4,
    /** Shortened expiry applied while the pair's most recent message was spam-tier (see combo-spam-guard.ts) — a real message resets the pair back to the normal `expireMs` window. */
    spamExpireMs: 30 * 1000,
    /** Multiplier applied to scoreGain for spam-tier messages (single-word / repeated content) — dampened, not zeroed. */
    spamScoreMultiplier: 0.3,
    /** Window within which an author repeating the exact same message content is flagged as spam. */
    spamRepeatWindowMs: 60 * 1000,
    /** How many of an author's recent messages are remembered per-guild for repeat-content detection. */
    spamHistorySize: 5,
} as const;

export type ComboLeaderboardPeriod = "daily" | "weekly" | "monthly" | "alltime";
export const COMBO_LEADERBOARD_PERIODS: ComboLeaderboardPeriod[] = ["daily", "weekly", "monthly", "alltime"];

export type ComboLeaderboardType = "combo" | "streak" | "partner";