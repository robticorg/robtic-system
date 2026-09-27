import { client, TRANSFER_BOT_ID, workflowMessages, workflows } from ".";

client.on("messageCreate", async (message) => {

    if (!message.guildId) return;
    if (message.author.id === client.user?.id) return;
    if (message.author.id !== TRANSFER_BOT_ID) return;
    

    const workflow = workflows.find(
        (workflow) =>
            workflow.guildId === message.guildId &&
            workflow.channelId === message.channel.id,
    );

    if (!workflow) return;

    switch (workflow.step) {

        case "WAIT_TRANSFER": {

            if (!message.content.includes("type these numbers to confirm :",)) return;

            const attachment = message.attachments.first();

            if (!attachment) return;

            workflow.captchaMessageId = message.id;

            workflowMessages.set(
                message.id,
                workflow.userId,
            );

            workflow.step = "WAIT_CAPTCHA";

            console.log(`[TRANSFER] CAPTCHA received for ${workflow.userId}`,);
            return;
        }

        case "WAIT_CAPTCHA": {
            if (workflow.captchaMessageId !== message.id) return;
            
            return;
        }

        case "PROCESSING": return;

        case "DONE": return;
        
    }
});