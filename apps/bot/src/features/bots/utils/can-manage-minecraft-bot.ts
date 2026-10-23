import { SUPER_ADMIN_ID } from "@constants";
import { SuperUserRepository } from "@database/repositories";

/**
 * There is one Minecraft bot for the whole deployment, not one per server, so replacing or
 * deleting it is the bot operator's call — the owner and super users — not any server's admin.
 */
export async function canManageMinecraftBot(userId: string): Promise<boolean> {
    return userId === SUPER_ADMIN_ID || SuperUserRepository.isWhitelistedCached(userId);
}
