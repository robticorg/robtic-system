import { ClientManager } from "@core/client-manager";
import { connectDatabase } from "@database/connection";
import { Logger } from "@logger";
import { SUPER_ADMIN_ID } from "@constants";
import { SuperUserRepository } from "@database/repositories";
import { AllowedGuildRepository } from "@database/repositories";
import { migrateLevelSplit } from "@core/xp";
import { client, worker} from "./services/bank";
import { startBankApi } from "./services/bank/api";
import { PSM } from "tesseract.js";
import { waitForGatewayLeadership } from "./services/gateway-leadership";

await connectDatabase(process.env.MONGODB_URI!);

// Failover: with a standby container, only one Gateway may be logged in to Discord at a time.
// Returns at once without Redis (a single Gateway, as before).
await waitForGatewayLeadership();

// After leadership, not before: a standby can wait for days, and a server whitelist cached at its
// boot would miss every `/addserver` since — and the guild guard would leave those servers.
await Promise.all([SuperUserRepository.preload(), AllowedGuildRepository.preload()]);

// Separate message and voice levels: splits any record still on the old combined level. A no-op
// once everything is split. Before login, so no XP is granted while it runs.
await migrateLevelSplit();

if (!SUPER_ADMIN_ID) {
    Logger.warn("BOT_OWNER_ID is not set — no user holds the owner bypass. Admin-scoped commands are reachable only by /whitelist super users.");
}

const manager = ClientManager.getInstance();
manager.setBotModulesRoot(import.meta.dir);

await manager.start();

startBankApi();

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