import mongoose from "mongoose";
import { connectDatabase } from "@database/connection";
import { startInternalApi } from "@internal-api";
import { Logger } from "@logger";
import { invitesRoutes } from "./routes";

const SERVICE = "invites-api";

if (!process.env.MONGODB_URI) {
    Logger.error("MONGODB_URI is not set", SERVICE);
    process.exit(1);
}

await connectDatabase(process.env.MONGODB_URI);

startInternalApi({
    service: SERVICE,
    port: Number(process.env.INVITES_API_PORT) || 3005,
    routes: invitesRoutes(),
    onStop: async () => {
        await mongoose.disconnect();
    },
});
