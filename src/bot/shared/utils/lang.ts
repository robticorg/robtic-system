import type { GuildMember } from "discord.js";
import { ServerConfig } from "@database/models/ServerConfig";
import { User } from "@database/models/User";
import messages from "@shared/messages.json";

export type Lang = "en" | "ar";

/**
 * Resolves the language to render for a member: an explicit self-service choice (User.preferredLang,
 * set via /profile Settings) always wins; otherwise falls back to the guild's Arabic-role convention;
 * otherwise English.
 */
export async function getUserLang(member: GuildMember | null | undefined): Promise<Lang> {
    if (!member) return "en";

    const user = await User.findOne({ discordId: member.id });
    if (user?.preferredLang) return user.preferredLang;

    const config = await ServerConfig.findOne({ guildId: member.guild.id });
    const arRoleId = config?.roles?.ar;
    if (arRoleId && member.roles.cache.has(arRoleId)) return "ar";
    return "en";
}

export function t(path: string, lang: Lang, vars?: Record<string, string>): string {
    const keys = path.split(".");
    let value: unknown = (messages as Record<string, unknown>)[lang];

    for (const k of keys) {
        if (value && typeof value === "object") {
            value = (value as Record<string, unknown>)[k];
        } else {
            return path;
        }
    }

    if (typeof value !== "string") return path;

    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            value = (value as string).replaceAll(`{${k}}`, v);
        }
    }

    return value as string;
}
