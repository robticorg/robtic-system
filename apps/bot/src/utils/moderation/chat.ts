import {
    type GuildTextBasedChannel,
    type Guild,
    PermissionFlagsBits,
} from "discord.js";
import { L, errorText } from "@utils";

/** Whether @everyone currently has (status=true) or lacks (status=false) the permission in this channel. */
const everyoneHas = (channel: GuildTextBasedChannel, permission: keyof typeof PermissionFlagsBits, status: boolean) =>
    channel.permissionsFor(channel.guild.id)?.has(PermissionFlagsBits[permission]) === status;

/** Discord's slowmode ceiling: 6 hours. */
const MAX_SLOWMODE_SECONDS = 21_600;

/** `5s`, `10m`, `2h`, or a bare number of seconds; null when it's none of those. */
export function parseSlowmode(input: string): number | null {
    const text = input.trim().toLowerCase();
    if (/^\d+$/.test(text)) return Math.min(Number(text), MAX_SLOWMODE_SECONDS);
    const match = /^(\d+)\s*(s|m|h)$/.exec(text);
    if (!match) return null;
    const value = Number(match[1]);
    const seconds = match[2] === "h" ? value * 3600 : match[2] === "m" ? value * 60 : value;
    return Math.min(seconds, MAX_SLOWMODE_SECONDS);
}

/**
 * The channel utilities behind `/chat` and their shortcuts. Each returns the line to show, or null when the channel
 * can't take it (no permission overwrites, no bulk delete).
 */
export const ChatUtils = {
    lock: async (channel: GuildTextBasedChannel, guild: Guild) => {
        if (!("permissionOverwrites" in channel)) return null;
        if (everyoneHas(channel, "SendMessages", false)) return L("This channel is already locked.", "هذا الروم مقفل من قبل.");
        await channel.permissionOverwrites.edit(guild.id, { SendMessages: false });
        return L("🔒 Channel locked. Members can't send messages.", "🔒 تم قفل الروم. الأعضاء ما يقدرون يرسلون.");
    },

    unlock: async (channel: GuildTextBasedChannel, guild: Guild) => {
        if (!("permissionOverwrites" in channel)) return null;
        if (everyoneHas(channel, "SendMessages", true)) return L("This channel is already unlocked.", "هذا الروم مفتوح من قبل.");
        await channel.permissionOverwrites.edit(guild.id, { SendMessages: null });
        return L("🔓 Channel unlocked. Members can send messages again.", "🔓 تم فتح الروم. الأعضاء يقدرون يرسلون.");
    },

    hide: async (channel: GuildTextBasedChannel, guild: Guild) => {
        if (!("permissionOverwrites" in channel)) return null;
        if (everyoneHas(channel, "ViewChannel", false)) return L("This channel is already hidden.", "هذا الروم مخفي من قبل.");
        await channel.permissionOverwrites.edit(guild.id, { ViewChannel: false });
        return L("🙈 Channel hidden. Members can't see it.", "🙈 تم إخفاء الروم. الأعضاء ما يشوفونه.");
    },

    show: async (channel: GuildTextBasedChannel, guild: Guild) => {
        if (!("permissionOverwrites" in channel)) return null;
        if (everyoneHas(channel, "ViewChannel", true)) return L("This channel is already visible.", "هذا الروم ظاهر من قبل.");
        await channel.permissionOverwrites.edit(guild.id, { ViewChannel: null });
        return L("👀 Channel shown. Members can see it again.", "👀 تم إظهار الروم. الأعضاء يشوفونه.");
    },

    /** An unreadable duration is refused: it used to switch slowmode off silently. */
    slowmode: async (channel: GuildTextBasedChannel, durationStr: string = "0") => {
        const seconds = parseSlowmode(durationStr);
        if (seconds === null) {
            return errorText(L(`\`${durationStr}\` isn't a duration. Use 5s, 10m, 2h, or 0 to turn it off.`, `\`${durationStr}\` ليست مدة صحيحة. استخدم 5s أو 10m أو 2h، أو 0 للإلغاء.`));
        }
        await channel.setRateLimitPerUser(seconds);
        return seconds === 0
            ? L("🐢 Slowmode is off.", "🐢 تم إلغاء السلو مود.")
            : L(`🐢 Slowmode set to ${seconds} seconds.`, `🐢 تم ضبط السلو مود على ${seconds} ثانية.`);
    },

    clear: async (channel: GuildTextBasedChannel, amount: number = 100) => {
        if (!("bulkDelete" in channel)) return null;
        try {
            const deleted = await channel.bulkDelete(Math.min(Math.max(1, amount), 100), true);
            return L(`🧹 Deleted ${deleted.size} messages.`, `🧹 تم حذف ${deleted.size} رسالة.`);
        } catch {
            return errorText(L("Couldn't delete messages. Messages older than 14 days can't be bulk deleted.", "ما قدرت أحذف الرسائل. الرسائل الأقدم من 14 يوم ما تنحذف دفعة وحدة."));
        }
    },
};
