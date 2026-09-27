import { Events, type Message } from "discord.js";
import type { BotClient } from "@core/bot-client";
import { client, TRANSFER_BOT_ID, worker, workflowMessages, workflows } from "@bot/services/bank";
import { delay } from "@utils/delay";


export default {
    name: Events.MessageCreate,

    async execute(message: Message, _client: BotClient) {
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

                await delay(2_000);

                const currentWorkflow =
                    workflows.get(workflow.userId);

                if (!currentWorkflow) return;
                if (currentWorkflow.captchaMessageId !== message.id) return;

                currentWorkflow.step = "PROCESSING";

                try {

                    const response = await fetch(attachment.url);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);

                    const buffer = Buffer.from(await response.arrayBuffer());
                    const result = await worker.recognize(buffer);
                    const captcha = result.data.text.trim();

                    const guild = client.guilds.cache.get(message.guildId);
                    if (!guild) return;
                    const channel = guild.channels.cache.get(message.channelId);
                    if (!channel || !channel.isText()) return;
                    await channel.send(captcha);

                    currentWorkflow.step = "DONE";

                    if (currentWorkflow.transferMessageId) workflowMessages.delete(currentWorkflow.transferMessageId);
                    if (currentWorkflow.captchaMessageId) workflowMessages.delete(currentWorkflow.captchaMessageId);

                    workflows.delete(currentWorkflow.userId);

                } catch (error) {

                    console.error(
                        "OCR failed:",
                        error
                    );

                    if (workflow.transferMessageId) workflowMessages.delete(workflow.transferMessageId);

                    if (workflow.captchaMessageId) workflowMessages.delete(workflow.captchaMessageId);

                    workflows.delete(workflow.userId);
                }


                return;
            }

            case "WAIT_CAPTCHA": {
                if (workflow.captchaMessageId !== message.id) return;

                return;
            }

            case "PROCESSING": return;

            case "DONE": return;

        }
    },
};
