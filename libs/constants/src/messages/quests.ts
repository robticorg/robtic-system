import type { QuestTier } from "../quests";

/**
 * Every word the quest system says to a member.
 *
 * Kept here rather than beside the container builders so the whole voice of the feature can be
 * read — and reworded — in one place. The builders keep the parts that are not text: colours,
 * progress bars, layout, which timestamp style to use.
 *
 * Anything that formats a value the caller already has (a bar, a duration) is taken as a parameter
 * rather than computed, because this package deliberately depends on nothing.
 */

/** Client-rendered relative time, so a countdown never costs a message edit. */
const relative = (date: Date): string => `<t:${Math.floor(date.getTime() / 1000)}:R>`;

/**
 * The objective wording, keyed by mission template.
 *
 * Every quest card, board row, DM and progress line renders one of these, which makes them the
 * most-read strings in the feature. The template in `libs/core` still decides which metric it
 * tracks and what the target is — it just no longer owns how the objective is phrased.
 */
export const QUEST_MISSION_LABELS = {
    "send-messages": (target: number) => `أرسل ${target.toLocaleString()} رسالة`,
    "earn-xp": (target: number) => `اجمع ${target.toLocaleString()} نقطة خبرة`,
    /** Tracked in seconds; the objective is read in minutes. */
    "voice-minutes": (target: number) => `اقضِ ${Math.round(target / 60).toLocaleString()} دقيقة نشط بالفويس`,
    "voice-xp": (target: number) => `اجمع ${target.toLocaleString()} نقطة خبرة بالفويس`,
    "combo-score": (target: number) => `وصّل الكومبو لـ ${target.toLocaleString()} نقطة`,
    "combo-heat": (target: number) => `وصّل حرارة الكومبو لـ ${target.toLocaleString()}`,
    "reach-streak": (target: number) => `وصّل التتابع لـ ${target.toLocaleString()} يوم`,
    "earn-points": (target: number) => `اجمع ${target.toLocaleString()} نقطة`,
    "level-up": (target: number) => (target === 1 ? "ارفع مستوى وحد" : `ارفع ${target.toLocaleString()} مستوى`),
    "community-contribution": (target: number) => `ساهم بـ ${target.toLocaleString()} بتحدي الكوميونتي`,
} as const;

/** The emoji that stands for a difficulty everywhere it is named. */
export const QUEST_TIER_EMOJI: Record<QuestTier, string> = {
    easy: "🟢",
    normal: "🔵",
    hard: "🟣",
    golden: "🌟",
    vip: "💎",
    special: "🎁",
};

/** How the tier is announced above the quest title. Rarity is the whole appeal of the top two. */
export const QUEST_TIER_BADGE: Record<QuestTier, string> = {
    easy: "مهمة يومية",
    normal: "مهمة يومية",
    hard: "مهمة نادرة",
    golden: "مهمة أسطورية",
    vip: "مهمة VIP",
    special: "فعالية خاصة",
};

/** "سهلة", "VIP" — the tier as a word. */
const tierName = (tier: QuestTier): string =>
    tier === "vip" ? "VIP" : {
        easy: "سهلة",
        normal: "عادية",
        hard: "صعبة",
        golden: "ذهبية",
        special: "خاصة",
    }[tier as Exclude<QuestTier, "vip">];

/** Member-facing quest text: the posted card, the commands, the buttons, the DMs. */
export const QUEST_MESSAGES = {
    tierEmoji: QUEST_TIER_EMOJI,
    tierBadge: QUEST_TIER_BADGE,
    tierName,

    /** "🟢 سهلة" — the one place a tier turns into display text, so every surface spells it the same. */
    tierTitle: (tier: QuestTier): string => `${QUEST_TIER_EMOJI[tier]} ${tierName(tier)}`,

    /** Routing gap: a leaf in the manifest with no handler behind it. */
    notWired: "هالأمر الفرعي ما اشتغل لين الحين.",

    /** The posted quest card. */
    card: {
        author: (tier: QuestTier) => `${QUEST_TIER_EMOJI[tier]}  ${QUEST_TIER_BADGE[tier]}`,
        title: (tier: QuestTier) => `مهمة ${tierName(tier)}`,
        objective: (index: number, label: string) => `\`${index + 1}\`  ${label}`,
        noObjectives: "لا توجد أهداف.",

        rewardField: "المكافأة",
        rewardValue: (reward: number) => `🎯 **${reward.toLocaleString()}** نقطة`,

        placesField: "الأماكن",
        placesUnlimited: "♾️ غير محدود",
        placesFull: (total: number) => `🚫 **مكتملة** — تم أخذ كل الأماكن (${total})`,
        placesLeft: (left: number, total: number, bar: string) => `باقي **${left}** من ${total}\n\`${bar}\``,

        endsField: (closed: boolean) => (closed ? "انتهت" : "تنتهي"),
        endsValue: relative,

        objectiveCount: (count: number) => (count === 1 ? "هدف وحد" : `${count} أهداف`),
        footer: (objectiveCount: string, tier: QuestTier) =>
            tier === "vip"
                ? `${objectiveCount} · لأعضاء VIP بس · التقدم يتحدث تلقائيًا بعد المطالبة`
                : tier === "special"
                    ? `${objectiveCount} · تقدر تاخذها حتى لو عندك مهمة ثانية شغال عليها`
                    : `${objectiveCount} · التقدم يتحدث تلقائيًا بعد المطالبة · استخدم /quest عشان تشوف مهامك`,
    },

    /** The claim button. The label carries the remaining count so the button answers "worth clicking". */
    button: {
        full: "مكتملة",
        closed: "مغلقة",
        claim: "طالب",
        claimWithSlots: (left: number) => `طالب · باقي ${left}`,
        openEmoji: "⚔️",
        closedEmoji: "🔒",
    },

    /** One mission line with where the member has got to. */
    missionLine: (index: number, label: string, bar: string, value: number, target: number, done: boolean) =>
        `${done ? "✅" : `\`${index + 1}.\``} ${label}\n` +
        `\`${bar}\` ${value.toLocaleString()} / ${target.toLocaleString()}`,

    /** `/quest active` and a bare `?quest`. */
    active: {
        title: "🗺️ مهامك",
        empty:
            "ما عندك أي مهمة الحين.\n" +
            "المهام تطلع في تشانل المهام — دوس **طالب** على وحدة منها وتقدمك يتحدث لحاله.",
        footer: "التقدم يتحدث لحاله · بنرسل لك دي إم لما مهمة تخلص أو تنتهي",
        questField: (tierTitle: string, done: number, total: number) => `${tierTitle} — خلصت ${done}/${total}`,
        questMeta: (reward: number, endsAt: Date) =>
            `🎯 **${reward.toLocaleString()}** نقطة · تنتهي ${relative(endsAt)}`,
        summary: (count: number, totalReward: number) =>
            `شغال على **${count}** مهمة · **${totalReward.toLocaleString()}** نقطة بالانتظار`,
    },

    /** `/quest board`. */
    board: {
        title: "لوحة المهام",
        empty:
            "ما فيه شي متاح الحين.\n\n" +
            "المهام تطلع بأوقات غير معلنة حسب فترات السيرفر — " +
            "رجّع بعدين، أو تابع تشانل المهام.",
        footer: "طالب من رسالة المهمة نفسها — وبعدها تقدمك يتحدث لحاله.",

        status: {
            claimed: "✅ مطالب فيها",
            vipOnly: "🔒 لأعضاء VIP بس",
            full: "❌ مكتملة",
            slotBusy: "⏳ خلّص مهمتك الحالية من نفس النوع أول",
            open: "🟩 متاحة لك",
        },

        slotsUnlimited: "أماكن غير محدودة",
        slotsLeft: (left: number, total: number) => `باقي ${left}/${total}`,
        link: (guildId: string, channelId: string, messageId: string) =>
            ` · [روح لها](https://discord.com/channels/${guildId}/${channelId}/${messageId})`,

        questField: (tierTitle: string, reward: number) => `${tierTitle} — ${reward.toLocaleString()} نقطة`,
        objective: (label: string) => `• ${label}`,
        questMeta: (status: string, slots: string, endsAt: Date, link: string) =>
            `${status} · ${slots} · تنتهي ${relative(endsAt)}${link}`,
    },

    /** `/quest top`. */
    top: {
        title: "🏆 متصدرين المهام",
        medals: ["🥇", "🥈", "🥉"] as readonly string[],
        empty: "محد خلص أي مهمة هنا لين الحين. كن أول واحد.",
        row: (medal: string, discordId: string, completed: number, pointsEarned: number) =>
            `${medal} <@${discordId}> — خلّص **${completed.toLocaleString()}** · 🎯 ${pointsEarned.toLocaleString()}`,
        fallbackMedal: (index: number) => `\`#${index + 1}\``,
        yourRank: (rank: number) => `ترتيبك #${rank}`,
        unranked: "لسا ما لك ترتيب",
    },

    /** `/quest stats` and the `/profile` quest tab. */
    stats: {
        title: (username: string) => `🗺️ سجل المهام — ${username}`,
        emptySelf: "ما طالبت بأي مهمة لين الحين. شوف `/quest board` عشان تعرف وش متاح.",
        emptyOther: "هذا العضو ما طالب بأي مهمة لين الحين.",

        overallField: "عام",
        overallValue: (claimed: number, completed: number, failed: number, rate: number, active: number) =>
            `طالب بـ **${claimed.toLocaleString()}**\n` +
            `خلّص **${completed.toLocaleString()}**\n` +
            `فشل بـ **${failed.toLocaleString()}**\n` +
            `نسبة الإنجاز **${rate}%**` +
            (active > 0 ? `\nشغال على **${active}** الحين` : ""),

        difficultyField: "حسب الصعوبة",
        difficultyValue: (easy: number, normal: number, hard: number, golden: number, vip: number) =>
            `🟢 سهلة **${easy.toLocaleString()}**\n` +
            `🔵 عادية **${normal.toLocaleString()}**\n` +
            `🟣 صعبة **${hard.toLocaleString()}**\n` +
            `🌟 ذهبية **${golden.toLocaleString()}**\n` +
            `💎 VIP **${vip.toLocaleString()}**`,

        timingField: "التوقيت",
        /** `fastest` and `average` arrive already formatted — durations belong to the caller. */
        timingValue: (fastest: string, average: string, firstPlaces: number) =>
            `الأسرع **${fastest}**\n` +
            `المتوسط **${average}**\n` +
            `أول وحد يخلص **${firstPlaces.toLocaleString()}×**`,
        noDuration: "—",

        rewardsField: "المكافآت",
        rewardsValue: (points: number) => `🎯 **${points.toLocaleString()}** نقطة`,

        communityField: "المجتمع",
        communityValue: (challenges: number, contributed: number) =>
            `🌍 شارك بـ **${challenges.toLocaleString()}** تحدي\n📈 ساهم بـ **${contributed.toLocaleString()}**`,

        rankField: "ترتيبه بالسيرفر",
        rankValue: (rank: number) => `#${rank}`,
        unranked: "بدون ترتيب",

        lastCompletionFooter: "آخر إنجاز",
    },

    /** Ephemeral replies to the claim button. */
    claim: {
        guildOnly: "المهام تشتغل بس داخل سيرفر.",
        failure: {
            "not-found": "هذي المهمة ما عادت موجودة.",
            ended: "هذي المهمة انتهت خلاص.",
            "already-holding": "عندك مهمة شغال عليها من نفس النوع. خلصها، أو انتظر لين تنتهي.",
            "not-vip": "مهام VIP بس لأعضاء عندهم رول VIP.",
            error: "صار خطأ وأنت تطالب فيها. حاول مرة ثانية بعد شوي.",
        } as Record<string, string>,
        full: (slotsTotal?: number | null) =>
            `كل الأماكن راحت${slotsTotal ? ` — كل الـ${slotsTotal}` : ""}.`,
        objective: (label: string) => `• ${label}`,
        claimed: (objectives: string, reward: number, endsAt: Date) =>
            `**تم!** تقدمك يتحدث لحاله — مافيه شي ثاني تسويه.\n\n${objectives}\n\n` +
            `المكافأة: **${reward.toLocaleString()}** نقطة · تنتهي ${relative(endsAt)}`,
    },

    /** `/quest post` — the admin-posted Special. */
    post: {
        adminOnly: "بس أدمن السيرفر يقدر ينشر مهمة خاصة.",
        buildFailed: "ما قدرنا ننشئ مهمة خاصة — ما فيه قوالب مهام تطابقت. ما تم نشر شي.",
        title: "🎁 تم نشر مهمة خاصة",
        objective: (index: number, label: string) => `\`${index + 1}\` ${label}`,
        rewardField: "المكافأة",
        rewardValue: (reward: number) => `🎯 **${reward.toLocaleString()}** نقطة`,
        placesField: "الأماكن",
        placesValue: (slotsTotal: number | null) => `${slotsTotal ?? "غير محدود"}`,
        endsField: "تنتهي",
        endsValue: relative,
        footer: (
            reward: { min: number; max: number },
            slots: { min: number; max: number } | null,
        ) =>
            `بين ${reward.min}–${reward.max} نقطة` +
            (slots ? ` و${slots.min}–${slots.max} مكان` : "") +
            " · أي أحد يقدر يطالب فيها حتى لو عنده مهمة ثانية",
    },

    /** The DMs sent when a claim resolves — the only moment the bot has anything to say about it. */
    dm: {
        unknownGuild: "السيرفر",
        rankSuffix: ["🥇 أول وحد يخلص", "🥈 ثاني وحد", "🥉 ثالث وحد"] as readonly string[],
        rankFallback: (rank: number) => `خلص بالترتيب #${rank}`,

        completed: {
            title: "✅ خلصت المهمة",
            description: (tierTitle: string, guildName: string, missions: string) =>
                `خلصت مهمتك **${tierTitle}** في **${guildName}**.\n\n${missions}`,
            missionLine: (label: string) => `✅ ${label}`,
            rewardField: "المكافأة",
            rewardValue: (reward: number) => `🎯 **${reward.toLocaleString()}** نقطة — تم دفعها`,
            rankField: "خلصت",
            durationField: "استغرقت",
            footer: "المكان صار فاضي — طالب بالمهمة الجاية أول ما تطلع.",
        },

        expired: {
            title: "⌛ انتهت المهمة",
            description: (tierTitle: string, guildName: string, missions: string) =>
                `خلص وقت مهمتك **${tierTitle}** في **${guildName}**.\n\n${missions}`,
            missionLine: (label: string, bar: string, value: number, target: number, done: boolean) =>
                `${done ? "✅" : "▫️"} ${label}\n\`${bar}\` ${value.toLocaleString()} / ${target.toLocaleString()}`,
            progressField: "وصلت لين وين",
            progressValue: (completed: number, total: number) => `خلصت ${completed} من ${total} هدف`,
            footer: "مافيه عقوبة — مكانك صار فاضي، خذ المهمة الجاية إذا حبيت.",
        },
    },
} as const;
