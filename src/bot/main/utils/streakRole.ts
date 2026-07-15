import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { GuildFeature, type Guild, type GuildMember, type Role } from "discord.js";
import { Logger } from "@core/libs";

const CTX = "main:streak-role";
const STREAK_IMAGES_DIR = join(process.cwd(), "images", "streak");
const ICON_FILENAME_PATTERN = /^fire(\d+)-(\d+)\.png$/i;
const STREAK_ROLE_NAME_PATTERN = /^Streak (\d+)$/i;

interface StreakIconRange {
    min: number;
    max: number;
    filePath: string;
}

let cachedRanges: StreakIconRange[] | null = null;

/** Scans images/streak for fire<min>-<max>.png files and builds sorted level ranges. */
function loadIconRanges(): StreakIconRange[] {
    if (cachedRanges) return cachedRanges;

    const ranges: StreakIconRange[] = [];
    let files: string[] = [];
    try {
        files = readdirSync(STREAK_IMAGES_DIR);
    } catch {
        cachedRanges = ranges;
        return ranges;
    }

    for (const file of files) {
        const match = ICON_FILENAME_PATTERN.exec(file);
        if (!match) continue;
        ranges.push({ min: Number(match[1]), max: Number(match[2]), filePath: join(STREAK_IMAGES_DIR, file) });
    }

    ranges.sort((a, b) => a.min - b.min);
    cachedRanges = ranges;
    return ranges;
}

function getIconPathForLevel(level: number): string | null {
    const ranges = loadIconRanges();
    if (ranges.length === 0) return null;

    const exact = ranges.find(r => level >= r.min && level <= r.max);
    if (exact) return exact.filePath;

    // Gap between defined ranges, or beyond the highest range: carry forward the last applicable icon.
    const applicable = [...ranges].reverse().find(r => r.min <= level);
    return applicable ? applicable.filePath : ranges[0].filePath;
}

/** Finds the guild's role for a streak level by name, creating it (with icon, if supported) only if missing. */
export async function ensureStreakRole(guild: Guild, level: number): Promise<Role> {
    const name = `Streak ${level}`;
    const existing = guild.roles.cache.find(r => r.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;

    const iconPath = getIconPathForLevel(level);
    let icon: Buffer | undefined;
    if (iconPath && guild.features.includes(GuildFeature.RoleIcons)) {
        try {
            icon = readFileSync(iconPath);
        } catch (err) {
            Logger.warn(`Failed to read streak icon at ${iconPath}: ${err}`, CTX);
        }
    }

    try {
        return await guild.roles.create({ name, icon, mentionable: false, reason: "Auto-created streak role" });
    } catch (err) {
        Logger.warn(`Failed to create streak role "${name}" with icon, retrying without icon: ${err}`, CTX);
        return guild.roles.create({ name, mentionable: false, reason: "Auto-created streak role" });
    }
}

/** Swaps the member's previous streak-level role for the one matching their current streak (or clears it if the streak is gone). */
export async function applyStreakRole(member: GuildMember, level: number): Promise<void> {
    const existingStreakRoles = member.roles.cache.filter(r => STREAK_ROLE_NAME_PATTERN.test(r.name));

    if (level <= 0) {
        for (const role of existingStreakRoles.values()) {
            await member.roles.remove(role).catch(() => null);
        }
        return;
    }

    const target = await ensureStreakRole(member.guild, level);

    for (const role of existingStreakRoles.values()) {
        if (role.id !== target.id) {
            await member.roles.remove(role).catch(() => null);
        }
    }

    if (!member.roles.cache.has(target.id)) {
        await member.roles.add(target).catch(() => null);
    }
}
