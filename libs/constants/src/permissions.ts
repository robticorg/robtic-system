import type { PermissionResolvable } from "discord.js";
import { BRANCH_CONFIG } from "@config";

export const STAFF_TEAM_ROLE_ID = BRANCH_CONFIG.roles.staffTeam;
export const FULL_POWER_ROLE_IDS: string[] = BRANCH_CONFIG.roles.fullPower;
/** Only this user may add/remove entries in the super user whitelist (/whitelist). */
export const SUPER_ADMIN_ID = BRANCH_CONFIG.roles.superAdmin;

const ROLE_IDS = BRANCH_CONFIG.roles.permissionMap;

/** Every permission level with the role ids/names that grant it and the Discord permissions it implies. */
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

/** Numeric rank per permission level; higher outranks lower. */
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

/** Which manager levels each lead level oversees. */
export const LEAD_MANAGER_MAP: Record<string, PermissionLevel[]> = {
    LeadDev: ["DevManager"],
    LeadDesign: ["DesignManager"],
    LeadModerator: ["OperationManager", "ModerationManager"],
    LeadCommunity: ["CommunityManager", "ContentManager", "EventManager"],
    LeadSupport: ["HRManager", "SupportManager"],
};

/** Department owned by each manager level. */
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

/** Role names that mark membership of each department. */
export const DEPARTMENT_ROLES: Record<Department, string[]> = {
    Dev: ["Development Department"],
    Design: ["Design Department"],
    Moderation: ["Moderation Department"],
    Community: ["Community Department"],
    Events: ["Events Department"],
    Support: ["Support Department"],
    HR: ["HR Department"],
};