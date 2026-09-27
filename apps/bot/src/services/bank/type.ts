type WorkflowStep =
    | "WAIT_TRANSFER"
    | "WAIT_CAPTCHA"
    | "PROCESSING"
    | "DONE";

interface Workflow {
    userId: string;
    guildId: string;
    channelId: string;

    transferMessageId?: string;
    captchaMessageId?: string;

    amount: string;
    step: WorkflowStep;

    createdAt: number;
}

interface StartTransferOptions {
    userId: string;
    guildId: string;
    channelId: string;
    amount: string;
    sendMessage: (content: string) => Promise<{
        id: string;
    }>;
}

export type { Workflow, WorkflowStep, StartTransferOptions };