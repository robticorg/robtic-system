/**
 * `/quest-config` replies.
 *
 * Admin-facing, so the tone is different from `QUEST_MESSAGES`: every one of these confirms what was
 * written *and* what it means for generation, because the failure mode of this command group is an
 * engine that keeps running and quietly achieves nothing.
 */

/**
 * The parts of a stored generation window this file needs to spell out.
 *
 * Declared structurally rather than imported from `@database/models`: constants sit under the
 * database layer, not above it, and `IQuestWindow` satisfies this shape as it stands.
 */
interface QuestWindowShape {
    key: string;
    startHour: number;
    endHour: number;
    enabled: boolean;
}

/** "UTC+05:30". Minutes east of UTC, because +05:45 exists and nothing here models timezones. */
export const utcClock = (minutes: number): string => {
    const sign = minutes < 0 ? "-" : "+";
    const abs = Math.abs(minutes);
    return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
};

const hourRange = (startHour: number, endHour: number): string =>
    `${String(startHour).padStart(2, "0")}:00 ← ${String(endHour).padStart(2, "0")}:00`;

/**
 * A tuning value that may be fixed or rolled — `QuestRange` restated locally.
 *
 * Spelling the range out matters for Special, whose reward, mission count and places are all ranges:
 * interpolating one directly reads as `[object Object]`.
 */
type RangeLike = number | { min: number; max: number };

const range = (value: RangeLike): string =>
    typeof value === "number"
        ? value.toLocaleString()
        : `${value.min.toLocaleString()}–${value.max.toLocaleString()}`;

export const QUEST_CONFIG_MESSAGES = {
    utcClock,

    channel: {
        quest: (mention: string) => `كل المهام — سهلة، عادية، صعبة، ذهبية و VIP — بتنشر في ${mention}.`,
        community: (mention: string) =>
            `تحدي الكوميونتي الأسبوعي بينشر في ${mention}.\n` +
            "اللوحة تنشر مرة وحدة وتتحدث طول الأسبوع — خلها تشانل الأعضاء يلقونه بسهولة.",
    },

    mention: {
        communityLabel: "🌍 الكوميونتي",
        set: (label: string, roleId: string) => `مهام ${label} بتمنشن <@&${roleId}>.`,
        cleared: (label: string) => `مهام ${label} ما بتمنشن أحد بعد الحين.`,
        listTitle: "رولات منشن المهام",
        listRow: (label: string, roleId: string | null) => `${label} — ${roleId ? `<@&${roleId}>` : "*بدون منشن*"}`,
    },

    vipRole: {
        added: (roleId: string, count: number) =>
            `<@&${roleId}> صار يقدر يطالب بمهام VIP — معدّل ${count} رول VIP.`,
        removed: (roleId: string) => `<@&${roleId}> ما عاد يقدر يطالب بمهام VIP.`,
        removedLast: (roleId: string) => `تم حذف <@&${roleId}>. بدون رولات VIP، محد بيقدر يطالب بمهام VIP.`,
        listTitle: "رولات VIP",
        listRow: (roleId: string) => `• <@&${roleId}>`,
        listEmpty:
            "ما فيه رولات VIP معدّلة، يعني مهام VIP محد يقدر يطالب فيها.\n" +
            "ضيف وحد بـ `/quest-config vip-role add`.",
    },

    window: {
        unusableKey: "هذا الاسم ما فيه حروف صالحة — جرب شي زي `morning`.",
        tooMany: (max: number) => `هذا السيرفر عنده ${max} فترة بالفعل — احذف وحدة قبل لا تضيف جديدة.`,
        describe: (window: QuestWindowShape) =>
            `**${window.key}** — ${hourRange(window.startHour, window.endHour)}` +
            (window.endHour <= window.startHour ? " *(تمتد لليوم الثاني)*" : "") +
            (window.enabled ? "" : " *(متوقفة)*"),
        saved: (existed: boolean, described: string) =>
            `${existed ? "تم تحديث" : "تمت إضافة"} الفترة ${described}\n` +
            "المهام تطلع بدقيقة غير معلنة داخل الفترة — نفس الدقيقة لكل السيرفر، " +
            "وتختلف عن باقي السيرفرات.",
        notFound: (key: string) => `ما فيه فترة اسمها **${key}**. شوف \`/quest-config window list\` عشان تشوفهم.`,
        removed: (key: string) => `تم حذف **${key}**.`,
        removedLast: (key: string) => `تم حذف **${key}**. بدون فترات، ما بتطلع أي مهام يومية.`,
        listTitle: "فترات توليد المهام",
        listEmpty: "ما فيه فترات معدّلة — ما بتطلع أي مهام يومية.",
        listFooter: (clock: string) => `الساعات محسوبة بتوقيت ${clock} · غيّره بـ /quest-config offset`,
    },

    tier: {
        cadenceDaily: (min: number, max: number) => `${min}–${max} باليوم`,
        cadenceWeekly: (min: number, max: number) => `${min}–${max} بالأسبوع`,
        cadencePerWindow: "وحدة لكل فترة توليد",
        slotsUnlimited: "مطالبات غير محدودة",
        slots: (slots: RangeLike) => `${range(slots)} مكان مطالبة`,
        enabled: (tierTitle: string, cadence: string, missions: RangeLike, reward: RangeLike, slots: string) =>
            `مهام ${tierTitle} شغالة — ${cadence}، ${range(missions)} هدف، ` +
            `${range(reward)} نقطة، ${slots}.`,
        disabled: (tierTitle: string) =>
            `مهام ${tierTitle} متوقفة. أي مهمة شغالة الحين بتكمل عادي.`,
    },

    offset: {
        /** `localNow` is the bot's own idea of the wall clock, so an admin can sanity-check it. */
        saved: (clock: string, localNow: string) =>
            `فترات المهام الحين تُحسب بتوقيت **${clock}** — يعني الساعة عندكم الحين **${localNow}**.\n` +
            "الفترات الموجودة تحافظ على ساعاتها، بس توقيتها الفعلي يتغير.",
    },

    community: {
        title: "التحدي الأسبوعي للكوميونتي",
        description: (enabled: boolean, reward: number, minimum: number, rankBonus: string) =>
            `**شغال:** ${enabled ? "أيوه، يفتح وحد جديد كل أسبوع" : "لا"}\n` +
            `**المكافأة الأساسية:** ${reward.toLocaleString()} نقطة لكل مساهم مؤهل\n` +
            `**أقل مساهمة:** ${minimum.toLocaleString()}\n` +
            `**بونص الترتيب:** ${rankBonus}`,
        footer: "التحدي اللي شغال حاليًا يحافظ على أرقامه اللي بدأ فيها.",
    },

    status: {
        title: "إعدادات المهام",
        notSet: "*غير محدد*",
        none: "*لا يوجد*",
        noRole: "—",
        communityLabel: "🌍 الكوميونتي",

        channelsField: "التشانلات",
        channelsValue: (quest: string, community: string) =>
            `المهام — ${quest}\nالكوميونتي — ${community}`,

        mentionsField: "المنشن",
        mentionRow: (label: string, roleId: string | null) => `${label} — ${roleId ? `<@&${roleId}>` : "—"}`,

        difficultiesField: "مستويات الصعوبة",
        difficultyRow: (enabled: boolean, tierTitle: string) => `${enabled ? "✅" : "🚫"} ${tierTitle}`,

        windowsField: (clock: string) => `الفترات (${clock})`,
        windowRow: (window: QuestWindowShape) =>
            `${window.enabled ? "•" : "○"} **${window.key}** ${hourRange(window.startHour, window.endHour)}`,

        vipRolesField: "رولات VIP",

        communityField: "تحدي الكوميونتي",
        communityOn: (reward: number, minimum: number) =>
            `شغال · أساس ${reward.toLocaleString()} نقطة · أقل مساهمة ${minimum.toLocaleString()}`,
        communityOff: "متوقف",

        warningsField: "⚠️ يحتاج انتباه",
        warningRow: (line: string) => `• ${line}`,
        warnings: {
            noQuestChannel: "ما فيه تشانل مهام — المهام اللي تتولد ما تنشر بأي مكان.",
            noCommunityChannel: "ما فيه تشانل كوميونتي — التحدي الأسبوعي يشتغل بدون ما أحد يشوفه.",
            noVipRoles: "ما فيه رولات VIP — مهام VIP تنشر بس محد يقدر يطالب فيها.",
            noWindows: "ما فيه فترات شغالة — ما بيتولد أي شي خالص.",
        },
    },
} as const;
