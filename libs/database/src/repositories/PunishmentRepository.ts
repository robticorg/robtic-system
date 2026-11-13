import { Punishment, type IPunishment } from "@database/models/Punishment";
import { MEMBER_PUNISHMENTS, PUNISHMENT_POINTS } from "@constants";

/** Which points a stored case type is worth (jails are stored as "ban"/"tempban"). */
const POINTS_BY_TYPE: Record<string, keyof typeof PUNISHMENT_POINTS> = { warn: "warn", mute: "mute", ban: "ban", tempban: "ban" };
import { L } from "@utils/lang-context";

/** How many times a new case retries when another one took its number at the same moment. */
const CASE_RETRIES = 5;
const caseNumber = (caseId: string | undefined) => Number(/^CASE-(\d+)$/.exec(caseId ?? "")?.[1] ?? 0);
const formatCase = (n: number) => `CASE-${n.toString().padStart(5, "0")}`;

export class PunishmentRepository {
    /**
     * Records a punishment under the server's next case number (`CASE-00001`, `CASE-00002`, … per server).
     *
     * The number is one past the server's highest, and the (server, case) pair is unique in the database, so two
     * punishments at the same moment can't share a number: the loser of the race tries the next one. Counting the
     * server's cases instead would repeat a number after any deletion.
     */
    static async createCase(data: Omit<Partial<IPunishment>, "caseId"> & { guildId: string }): Promise<IPunishment> {
        for (let attempt = 0; ; attempt++) {
            const last = await Punishment.find({ guildId: data.guildId }, { caseId: 1 }).sort({ createdAt: -1 }).limit(50).lean();
            const next = Math.max(0, ...last.map(p => caseNumber(p.caseId))) + 1 + attempt;
            try {
                return await Punishment.create({ ...data, caseId: formatCase(next) });
            } catch (err) {
                if ((err as { code?: number }).code !== 11000 || attempt >= CASE_RETRIES) throw err;
            }
        }
    }

    /** A case in this server (case numbers repeat across servers). */
    static async findByCaseId(caseId: string, guildId: string): Promise<IPunishment | null> {
        return Punishment.findOne({ caseId, guildId });
    }

    static async findByUser(userId: string, guildId: string): Promise<IPunishment[]> {
        return Punishment.find({ userId, guildId }).sort({ createdAt: -1 });
    }

    static async findAllByUserAndType(userId: string, guildId: string, type: IPunishment["type"]): Promise<IPunishment[]> {
        return Punishment.find({ userId, guildId, type }).sort({ createdAt: -1 });
    }

    static async findExpired(): Promise<IPunishment[]> {
        return Punishment.find({
            active: true,
            expiresAt: { $lte: new Date() },
        });
    }

    static async deactivate(caseId: string, guildId: string): Promise<IPunishment | null> {
        return Punishment.findOneAndUpdate(
            { caseId, guildId },
            { active: false },
            { returnDocument: "after" }
        );
    }

    static async appeal(caseId: string, guildId: string, reason: string): Promise<IPunishment | null> {
        return Punishment.findOneAndUpdate(
            { caseId, guildId },
            { appealed: true, active: false, appealReason: reason },
            { returnDocument: "after" }
        );
    }

    /**
     * A member's punishment level in one server, 0 to 100: the points of that server's cases that weren't appealed
     * (warn +5, mute +10, jail +20). Worked out from the cases rather than kept as a counter, so each server has its
     * own level, the history every server already has gives the right number, and it can't drift. A case removed early
     * (unmute, release) still counts; an appeal takes its points back.
     */
    static async getPunishmentLevel(guildId: string, userId: string): Promise<number> {
        const rows = await Punishment.aggregate<{ _id: string; count: number }>([
            { $match: { guildId, userId, appealed: { $ne: true } } },
            { $group: { _id: "$type", count: { $sum: 1 } } },
        ]);
        const points = rows.reduce((sum, r) => sum + r.count * (PUNISHMENT_POINTS[POINTS_BY_TYPE[r._id] ?? "warn"] ?? 0), 0);
        return Math.min(100, points);
    }

    /** The punishment step a level reaches; `name` is in the current language. */
    static getLevelInfo(level: number): { role: string | null; roleId: string | null; name: string } {
        if (level >= MEMBER_PUNISHMENTS.permBan.level) return { role: MEMBER_PUNISHMENTS.permBan.name, roleId: MEMBER_PUNISHMENTS.permBan.id, name: L("Permanent ban", "باند دائم") };
        if (level >= MEMBER_PUNISHMENTS.tempBan.level) return { role: MEMBER_PUNISHMENTS.tempBan.name, roleId: MEMBER_PUNISHMENTS.tempBan.id, name: L("Temporary ban", "باند مؤقت") };
        if (level >= MEMBER_PUNISHMENTS.tempMute.level) return { role: MEMBER_PUNISHMENTS.tempMute.name, roleId: MEMBER_PUNISHMENTS.tempMute.id, name: L("Temporary mute", "ميوت مؤقت") };
        if (level >= MEMBER_PUNISHMENTS.fWarn.level) return { role: MEMBER_PUNISHMENTS.fWarn.name, roleId: MEMBER_PUNISHMENTS.fWarn.id, name: L("Final warning", "إنذار نهائي") };
        if (level >= MEMBER_PUNISHMENTS.warn.level) return { role: MEMBER_PUNISHMENTS.warn.name, roleId: MEMBER_PUNISHMENTS.warn.id, name: L("Warning", "تحذير") };
        return { role: null, roleId: null, name: L("Clean", "نظيف") };
    }
}
