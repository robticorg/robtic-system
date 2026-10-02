import { workflowMessages, workflows, type StartTransferOptions, type Workflow, client } from ".";

export async function startTransfer({
    userId,
    guildId,
    channelId,
    amount,
}: StartTransferOptions) {

    if (workflows.has(userId)) return {
            success: false,
            reason: "ACTIVE_WORKFLOW",
        } as const;

    
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return {
            success: false,
            reason: "GUILD_NOT_FOUND",
        } as const;

    const channel = guild.channels.cache.get(channelId);
    if (!channel?.isText()) return {
            success: false,
            reason: "CHANNEL_NOT_FOUND",
        } as const;

    const transferMessage = await channel.send(
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