export interface StaffApplyType {
    key: string;
    name: string;
    isOpen: boolean;
    questionCount: number;
}

export interface StaffApplication {
    userId: string;
    username: string;
    department: string;
    isApproved: boolean;
    answers: { question: string; answer: string }[];
    createdAt: number;
}

export interface StaffMemberEntry {
    discordId: string;
    username: string;
    department: string;
    position: string;
    status: string;
    warningCount: number;
    hiredAt: number;
}

export interface StaffOverview {
    types: StaffApplyType[];
    applications: StaffApplication[];
    staff: StaffMemberEntry[];
}

export interface BotProfile {
    username: string;
    nick: string | null;
    avatarUrl: string | null;
    hasGuildAvatar: boolean;
}
