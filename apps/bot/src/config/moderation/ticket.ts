import { BRANCH_CONFIG } from "@config";

export interface TicketCategory {
    id: string;
    label: string;
    description: string;
    emoji?: string;
    parentId: string;
    supportRoleId: string;
    adminRoleId: string;
    staffPoints: number;
}

export const TICKET_CATEGORIES: TicketCategory[] = [
    {
        id: "public-support",
        label: "الـدعـم الـفـنـي",
        description: "اذا تريد اي مساعدة لحل مشاكلك لا تترد في فتح تذكرة و سيكون طاقم دعم الفني في خدمة",
        emoji: "🎫",
        parentId: BRANCH_CONFIG.channels.ticketCategory,
        supportRoleId: BRANCH_CONFIG.roles.ticketSupport,
        adminRoleId: BRANCH_CONFIG.roles.ticketAdmin,
        staffPoints: 1,
    },
    {
        id: "technical-support",
        label: "Technical Support",
        description: "Help with technical difficulties.",
        emoji: "🛠️",
        parentId: BRANCH_CONFIG.channels.ticketCategory,
        supportRoleId: BRANCH_CONFIG.roles.ticketSupport,
        adminRoleId: BRANCH_CONFIG.roles.ticketAdmin,
        staffPoints: 1,
    },
    {
        id: "feature-request",
        label: "Feature Request",
        description: "Ask for a feature or improvement.",
        emoji: "💡",
        parentId: BRANCH_CONFIG.channels.ticketCategory,
        supportRoleId: BRANCH_CONFIG.roles.ticketSupport,
        adminRoleId: BRANCH_CONFIG.roles.ticketAdmin,
        staffPoints: 1,
    },
    {
        id: "bug-report",
        label: "Bug Report",
        description: "Report bugs or mistakes.",
        emoji: "🐛",
        parentId: BRANCH_CONFIG.channels.ticketCategory,
        supportRoleId: BRANCH_CONFIG.roles.ticketSupport,
        adminRoleId: BRANCH_CONFIG.roles.ticketAdmin,
        staffPoints: 1,
    },
];

export const TICKET_REPORT_CHANNEL_ID = BRANCH_CONFIG.channels.ticketSupportReport;
export const TICKET_MANAGER_EMOJI = BRANCH_CONFIG.emojis.ticketManager;

export const TICKET_PANEL_COLOR = 0x0505ff;
export const TICKET_CREATED_COLOR = TICKET_PANEL_COLOR;
export const TICKET_CLOSED_COLOR = 0x050560;
export const TICKET_ESCALATED_COLOR = 0xff8c00;
