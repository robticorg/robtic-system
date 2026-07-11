import { BRANCH_CONFIG } from "@core/config";

export const TICKET_TEXTCHAT_CATEGORY_ID = BRANCH_CONFIG.channels.ticketCategory;
export const SUPPORT_ROLE_ID = BRANCH_CONFIG.roles.staffTeam;
export const SUPPORT_REPORT_CHANNEL_ID = BRANCH_CONFIG.channels.ticketSupportReport;

export const SUPPORT_ROLE = `<@&${SUPPORT_ROLE_ID}>`;
export const ROBO_MANAGER_EMOJI = BRANCH_CONFIG.emojis.ticketManager;

export const ACCENT_COLOR = 0x0505ff;
export const TICKET_CREATED_COLOR = ACCENT_COLOR;
export const TICKET_CLOSED_COLOR = 0x050560;