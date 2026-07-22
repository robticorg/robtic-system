import { ClientManager } from "@core/client-manager";
import { connectDatabase } from "@database/connection";
import { Logger } from "@logger";
import { SuperUserRepository } from "@database/repositories";

await connectDatabase(process.env.MONGODB_URI!);
await SuperUserRepository.preload();

const manager = ClientManager.getInstance();
manager.setBotModulesRoot(import.meta.dir);
await manager.startAll().then(() => {
    Logger.success("All bots initialized.");
})
