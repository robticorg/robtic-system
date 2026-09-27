import { workflowMessages, workflows, type StartTransferOptions, type Workflow } from ".";

export async function startTransfer({
    userId,
    guildId,
    channelId,
    amount,
    sendMessage,
}: StartTransferOptions) {

    if (workflows.has(userId)) return {
            success: false,
            reason: "ACTIVE_WORKFLOW",
        } as const;

    const transferMessage = await sendMessage(
        `!transfer ${userId} ${amount}`,
    );

    const workflow: Workflow = {
        userId,
        guildId,
        channelId,

        transferMessageId: transferMessage.id,

        amount,

        step: "WAIT_TRANSFER",

        createdAt: Date.now(),
    };

    workflows.set(userId, workflow);

    workflowMessages.set(
        transferMessage.id,
        userId,
    );

    return {
        success: true,
        workflow,
    } as const;
}