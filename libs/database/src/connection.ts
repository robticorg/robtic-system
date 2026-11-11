import mongoose, { type ConnectOptions } from "mongoose";
import { Logger } from "@logger";
import { handleError, BotError } from "@core/handlers";

export async function  connectDatabase(url: string): Promise<void> {
    try {
        await mongoose.connect(url, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        } as ConnectOptions);

        Logger.success(`MongoDB Connected: ${mongoose.connection.host}`, "Database");
        await dropRetiredIndexes();
    } catch (error) {
        handleError(new BotError("Failed to connect to MongoDB", "DATABASE"), "database/connection");
        process.exit(1);
    }
}

/**
 * Indexes the schemas no longer declare. Mongoose builds new indexes but never drops old ones, and these two would
 * still force one row per key across every server (LogConfig and Reason are per server now). Safe to run on every
 * start: a missing index is ignored.
 */
const RETIRED_INDEXES: readonly [collection: string, index: string][] = [
    ["logconfigs", "key_1"],
    ["reasons", "key_1"],
];

async function dropRetiredIndexes(): Promise<void> {
    for (const [collection, index] of RETIRED_INDEXES) {
        try {
            await mongoose.connection.collection(collection).dropIndex(index);
            Logger.info(`Dropped retired index ${collection}.${index}`, "Database");
        } catch {
            // Already gone (or the collection doesn't exist yet): nothing to do.
        }
    }
}

mongoose.connection.on("error", (err) => {
    handleError(new BotError(err.message, "DATABASE"), "mongoose");
});

mongoose.connection.on("disconnected", () => {
    Logger.warn("MongoDB disconnected", "Database");
});

process.on("SIGINT", async () => {
    await mongoose.connection.close();
    Logger.info("MongoDB connection closed (app termination)", "Database");
    process.exit(0);
});
