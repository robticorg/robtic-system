import type { Client } from "discord.js";

/** An inviter's username, from cache when possible. Inviters may have left, so this never needs a member. */
export async function inviterName(client: Client, inviterId: string): Promise<string> {
    const user = client.users.cache.get(inviterId) ?? await client.users.fetch(inviterId).catch(() => null);
    return user?.username ?? "Unknown user";
}
