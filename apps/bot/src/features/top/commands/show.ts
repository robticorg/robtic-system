import type { GuildMember } from "discord.js";
import type { FeatureSubcommandHandler } from "@typings/feature";
import { TOP_ALL_CATEGORIES, TOP_CATEGORIES, type ComboLeaderboardPeriod, type TopCategory } from "@constants";
import { getUserLang, t } from "@bot/utils/lang";
import { buildTopView, type TopScope } from "../utils";

const DEFAULT_PERIOD: ComboLeaderboardPeriod = "daily";

/**
 * Accepts the category loosely, since `!top Combo` is what someone types.
 *
 * Aliases exist because the two XP boards are the ones people name, and nobody types a hyphen:
 * `!top xp` means the messages board, `!top voice` the voice one.
 */
const ALIASES: Record<string, TopCategory> = {
    xp: "messages-xp",
    "message-xp": "messages-xp",
    "msg-xp": "messages-xp",
    messagexp: "messages-xp",
    voicexp: "voice-xp",
    "voice-time": "voice",
    text: "messages",
    chat: "messages",
    point: "points",
    total: "xp",
    "total-xp": "xp",
};

/** `#top day`, `#top week`, `!top month`, `!top all`, in English or Arabic. */
const PERIODS: Record<string, ComboLeaderboardPeriod> = {
    day: "daily", today: "daily", daily: "daily", d: "daily", "يوم": "daily", "اليوم": "daily",
    week: "weekly", weekly: "weekly", w: "weekly", "اسبوع": "weekly", "أسبوع": "weekly", "الاسبوع": "weekly", "الأسبوع": "weekly",
    month: "monthly", monthly: "monthly", m: "monthly", "شهر": "monthly", "الشهر": "monthly",
    all: "alltime", alltime: "alltime", ever: "alltime", lifetime: "alltime", "الكل": "alltime", "كل": "alltime",
};

function resolveScope(word: string): TopScope | null {
    if (word === TOP_ALL_CATEGORIES) return TOP_ALL_CATEGORIES;
    return TOP_CATEGORIES.find(c => c === (word as TopCategory)) ?? ALIASES[word] ?? null;
}

/**
 * Either option may hold either word, because a prefix command fills options in order: `#top day` puts "day" in
 * `category`. A period word there is read as the period, on the overview.
 */
function resolveRequest(category: string | null, periodInput: string | null): { scope: TopScope; period: ComboLeaderboardPeriod } | null {
    let scope: TopScope = TOP_ALL_CATEGORIES;
    let period = DEFAULT_PERIOD;
    for (const raw of [category, periodInput]) {
        const word = raw?.trim().toLowerCase();
        if (!word) continue;
        if (PERIODS[word]) {
            period = PERIODS[word]!;
            continue;
        }
        const found = resolveScope(word);
        if (!found) return null;
        scope = found;
    }
    return { scope, period };
}

export const show: FeatureSubcommandHandler = async (interaction, _client) => {
    await interaction.deferReply();

    const guild = interaction.guild;
    const lang = await getUserLang(interaction.member as GuildMember | null);

    if (!guild) {
        await interaction.editReply({ content: t("combo.guild_only", lang) });
        return;
    }

    const request = resolveRequest(interaction.options.getString("category"), interaction.options.getString("period"));
    if (!request) {
        await interaction.editReply({
            content: t("top.unknown_category", lang, { categories: TOP_CATEGORIES.join(", ") }),
        });
        return;
    }

    const view = await buildTopView(guild, request.scope, request.period, lang, { id: interaction.user.id, name: interaction.user.username }, 0);
    await interaction.editReply(view);
};
