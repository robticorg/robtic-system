import type { GuildMember } from "discord.js";
import { ServerConfig } from "@database/models/ServerConfig";
import messages from "@shared/messages.json";

export type Lang = "en" | "ar";

export async function getUserLang(member: GuildMember | null | undefined): Promise<Lang> {
    if (!member) return "en";
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
