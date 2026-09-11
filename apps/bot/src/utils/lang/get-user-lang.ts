import type { GuildMember } from "discord.js";
import type { Lang } from "@typings/lang";

/**
 * The bot is Arabic-only for now — English is removed rather than kept as a fallback. Still async
 * and still takes a member, so the day a second language comes back the call sites (and the
 * `User.preferredLang` / guild Arabic-role resolution this replaced) do not need to change again.
 */
export async function getUserLang(_member: GuildMember | null | undefined): Promise<Lang> {
    return "ar";
}
