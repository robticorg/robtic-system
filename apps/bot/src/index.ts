import { ClientManager } from "@core/client-manager";
import { connectDatabase } from "@database/connection";
import { Logger } from "@logger";
import { SUPER_ADMIN_ID } from "@constants";
import { SuperUserRepository } from "@database/repositories";
import { AllowedGuildRepository } from "@database/repositories";
import { client, TRANSFER_BOT_ID, worker, workflowMessages, workflows} from "./services/bank";
import { PSM } from "tesseract.js";

await connectDatabase(process.env.MONGODB_URI!);
await Promise.all([SuperUserRepository.preload(), AllowedGuildRepository.preload()]);

if (!SUPER_ADMIN_ID) {
    Logger.warn("BOT_OWNER_ID is not set — no user holds the owner bypass. Admin-scoped commands are reachable only by /whitelist super users.");
}

const manager = ClientManager.getInstance();
manager.setBotModulesRoot(import.meta.dir);

await manager.start();

client.login(process.env.BANK_TOKEN!).then(() => {
    console.log(`${client.user?.username} is ready!`);
}).catch((error) => {
    console.error("Failed to login the client:", error);
});

await worker.setParameters({
    tessedit_char_whitelist: "0123456789",
    tessedit_pageseg_mode: PSM.SINGLE_LINE,
});

Logger.success("Bot initialized.");

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