/** One application (submission) type with its open/closed state, for the Activity's staff panel. */
export interface StaffApplyType {
    key: string;
    name: string;
    isOpen: boolean;
    questionCount: number;
}

/** One submitted application awaiting review. */
export interface StaffApplication {
    userId: string;
    username: string;
    department: string;
    isApproved: boolean;
    answers: { question: string; answer: string }[];
    /** Unix ms. */
    createdAt: number;
}

/** One staff member row for the Activity's staff panel. */
export interface StaffMemberEntry {
    discordId: string;
    username: string;
    department: string;
    position: string;
    status: string;
    warningCount: number;
    /** Unix ms. */
    hiredAt: number;
}

export interface StaffOverview {
    types: StaffApplyType[];
    applications: StaffApplication[];
    staff: StaffMemberEntry[];
}
