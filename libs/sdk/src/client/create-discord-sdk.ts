import { DiscordSDK } from "@discord/embedded-app-sdk";

let instance: DiscordSDK | null = null;

/** Singleton Discord Embedded App SDK client for the current activity frame. */
export function createDiscordSdk(clientId: string): DiscordSDK {
    if (!instance) {
        instance = new DiscordSDK(clientId);
    }
    return instance;
}
