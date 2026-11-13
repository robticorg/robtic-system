import { bilingual } from "@utils/lang-context";

/** Values that are ids or limits, not words: the same in every language. */
const HELP_FIXED = {
    /** Category bucket for commands that declare no `category`. Always sorted first. A key, not a label. */
    generalCategory: "General",
    overviewSelectValue: "__overview__",
    selectCustomId: "help:category",
    adminOnlyCategory: "Admin",
    prevCustomId: "help:prev",
    nextCustomId: "help:next",
    /** Discord's message-content ceiling, which the text view is budgeted against. */
    textLimit: 2000,
} as const;

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Arabic names for the command categories (the keys stay English). */
const CATEGORY_AR: Record<string, string> = {
    General: "عام", Streak: "الستريك", Economy: "الاقتصاد", Activity: "النشاط", Profile: "البروفايل", Leaderboard: "التوب",
    Leveling: "المستويات", Moderation: "الإشراف", Partnership: "الشراكات", Projects: "المشاريع", Configuration: "الإعدادات",
    Admin: "الإدارة", Utility: "أدوات", Music: "الموسيقى",
};

/** Labels and copy for the `!help` command (overview + category dropdown). */
export const HELP = bilingual({
    ...HELP_FIXED,
    categoryLabel: (category: string) => category,
    overviewSelectLabel: "🏠 Overview",
    selectPlaceholder: "📂 Pick a command category…",
    title: (botName: string) => `📖 ${botName}: commands`,
    categoryTitle: (botName: string, category: string) => `📖 ${botName}: ${category}`,
    intro: (prefix: string) =>
        `Every command works two ways: type \`${prefix}command\` in chat, or use \`/command\`.\n` +
        "Get a command wrong (a missing argument, say) and I'll reply with how to use it.",
    categoriesLine: (categories: string[]) => `**Categories:** ${categories.join(" • ")}`,
    pickPrompt: "Use the menu below to browse a category's commands and how to use them.",
    slashOnlyNote: (name: string) => `⚠️ Slash only: use \`/${name}\` (it opens a form).`,
    footer: (count: number) => `${count} ${plural(count, "command", "commands")} • ! or / both work`,
    emptyCategory: "No commands in this category.",
    noCommands: "No commands are available here.",

    featuresHeading: "**Features:**",
    featureOn: (key: string) => `🟢 ${key}`,
    featureOff: (key: string) => `⚪ ${key}`,
    featuresHint: (_prefix: string) => "Grey features are off here. An admin can turn them on from the dashboard.",
    /** Appended to a command whose feature is switched off in this server. */
    disabledNote: "⚪ Its feature is off in this server.",

    categoryCount: (name: string, count: number) => `${name} \`${count}\``,
    detailHint: (prefix: string) => `Want one command in full? \`${prefix}help <command>\` lists every form of it.`,
    /** Shown under a command that has subcommands, instead of listing all of them. */
    subcommandCount: (count: number) => `${count} ${plural(count, "subcommand", "subcommands")}`,
    commandTitle: (botName: string, name: string) => `📖 ${botName}: /${name}`,
    unknownCommand: (input: string, prefix: string) => `There's no command called \`${input}\`. Use \`${prefix}help\` to see them all.`,
    pageFooter: (page: number, pages: number, count: number) =>
        `Page ${page}/${pages} • ${count} ${plural(count, "command", "commands")} • ! or / both work`,
    prevButton: "<",
    nextButton: ">",
    /** A category whose commands could not all fit even after paging. */
    truncatedNote: (dropped: number) => `…and ${dropped} more. Narrow it down with \`help <command>\`.`,

    textCommandLine: (invocation: string) => `**Command:** \`${invocation}\``,
    textShortcutLine: (triggers: string) => `**Shortcut:** ${triggers}`,
    textUsageHeading: "**Usage:**",
    noShortcuts: "*none set*",
}, {
    ...HELP_FIXED,
    categoryLabel: (category: string) => CATEGORY_AR[category] ?? category,
    overviewSelectLabel: "🏠 نظرة عامة",
    selectPlaceholder: "📂 اختر قسم الأوامر…",
    title: (botName: string) => `📖 ${botName}: الأوامر`,
    categoryTitle: (botName: string, category: string) => `📖 ${botName}: ${category}`,
    intro: (prefix: string) =>
        `كل أمر يشتغل بطريقتين: اكتب \`${prefix}الأمر\` في الشات، أو استخدم \`/الأمر\`.\n` +
        "إذا كتبت الأمر غلط (مثلاً ناقص شي) بأرد عليك بطريقة استخدامه.",
    categoriesLine: (categories: string[]) => `**الأقسام:** ${categories.join(" • ")}`,
    pickPrompt: "استخدم القائمة تحت لتصفح أوامر كل قسم وطريقة استخدامها.",
    slashOnlyNote: (name: string) => `⚠️ سلاش فقط: استخدم \`/${name}\` (يفتح نموذج).`,
    footer: (count: number) => `${count} أمر • ! أو / كلها تشتغل`,
    emptyCategory: "ما في أوامر في هذا القسم.",
    noCommands: "ما في أوامر متاحة هنا.",

    featuresHeading: "**الأنظمة:**",
    featureOn: (key: string) => `🟢 ${key}`,
    featureOff: (key: string) => `⚪ ${key}`,
    featuresHint: (_prefix: string) => "الأنظمة الرمادية مقفلة هنا. يقدر المسؤول يفعّلها من لوحة التحكم.",
    disabledNote: "⚪ نظامه مقفل في هذا السيرفر.",

    categoryCount: (name: string, count: number) => `${name} \`${count}\``,
    detailHint: (prefix: string) => `تبي تفاصيل أمر معين؟ \`${prefix}help <الأمر>\` يعرض كل طرق استخدامه.`,
    subcommandCount: (count: number) => `${count} أمر فرعي`,
    commandTitle: (botName: string, name: string) => `📖 ${botName}: /${name}`,
    unknownCommand: (input: string, prefix: string) => `ما في أمر اسمه \`${input}\`. استخدم \`${prefix}help\` لتشوف كل الأوامر.`,
    pageFooter: (page: number, pages: number, count: number) => `صفحة ${page}/${pages} • ${count} أمر • ! أو / كلها تشتغل`,
    prevButton: "<",
    nextButton: ">",
    truncatedNote: (dropped: number) => `…و ${dropped} غيرها. حدد أكثر بـ \`help <الأمر>\`.`,

    textCommandLine: (invocation: string) => `**الأمر:** \`${invocation}\``,
    textShortcutLine: (triggers: string) => `**الاختصار:** ${triggers}`,
    textUsageHeading: "**الاستخدام:**",
    noShortcuts: "*لا يوجد*",
});

/** Per-category emoji for the help dropdown/embeds; falls back to 📁. */
export const HELP_CATEGORY_EMOJI: Record<string, string> = {
    General: "📋",
    Streak: "🔥",
    Economy: "🪙",
    Activity: "💬",
    Profile: "🪪",
    Leaderboard: "🏆",
    Leveling: "📈",
    Moderation: "🛡️",
    Partnership: "🤝",
    Projects: "🚀",
    Configuration: "⚙️",
    Admin: "🔑",
    Utility: "🧰",
};

/** Static content of the moderation command-reference embed. */
export const MODERATION_HELP = bilingual({
    title: "🛡️ Moderation commands",
    fields: [
        { name: "Warnings", value: ["`/warn add @user <reason>`: warn someone (reason from the list)", "`/warn appeal @user <case>`: appeal a warning (takes its level points back)", "`/warn list @user`: every warning"].join("\n") },
        { name: "Mutes", value: ["`/mute add @user <reason> [duration]`: mute someone", "`/mute remove @user <case>`: unmute (keeps the level)", "`/mute appeal @user <case>`: appeal (takes the level points back)", "`/mute list @user`: every mute"].join("\n") },
        { name: "Jail", value: ["`/jail add @user <reason> [permanent] [duration]`: jail someone (case, level and timeout)", "`/jail remove @user <case>`: release (keeps the level)", "`/jail appeal @user <case>`: appeal (takes the level points back)", "`/jail list @user`: every jail case"].join("\n") },
        { name: "Server actions", value: ["`/ban @user [reason]`: ban from the server", "`/unban <user id> [reason]`: lift a ban", "`/kick @user [reason]`: kick from the server"].join("\n") },
        { name: "Roles", value: ["`/roles`: every role on the server", "`/role give @user <role>`: give a role", "`/role remove @user <role>`: take a role away", "`/role multirole @user <role1> … [role5]`: give several at once", "Roles at or above your own highest role can't be handed out."].join("\n") },
        { name: "Reasons", value: ["`/reason create <type>`: add a punishment reason (Manager+)", "`/reason remove <key>`: remove one (Manager+)", "`/reason list`: every reason"].join("\n") },
        { name: "Punishment levels", value: ["Each punishment adds to a member's level:", "• **Warn** +5 · **Mute** +10 · **Ban** +20", "", "**At level:** `20` warning role · `40` final warning role · `60` auto mute · `80` temporary ban · `100` permanent ban", "", "Junior moderators' punishments go to a senior for approval."].join("\n") },
    ],
}, {
    title: "🛡️ أوامر الإشراف",
    fields: [
        { name: "التحذيرات", value: ["`/warn add @عضو <السبب>`: تحذير عضو (السبب من القائمة)", "`/warn appeal @عضو <الحالة>`: استئناف تحذير (يرجع نقاط المستوى)", "`/warn list @عضو`: كل التحذيرات"].join("\n") },
        { name: "الميوت", value: ["`/mute add @عضو <السبب> [المدة]`: ميوت لعضو", "`/mute remove @عضو <الحالة>`: فك الميوت (المستوى يبقى)", "`/mute appeal @عضو <الحالة>`: استئناف (يرجع نقاط المستوى)", "`/mute list @عضو`: كل الميوتات"].join("\n") },
        { name: "السجن", value: ["`/jail add @عضو <السبب> [دائم] [المدة]`: سجن عضو (حالة ومستوى وتايم أوت)", "`/jail remove @عضو <الحالة>`: إطلاق (المستوى يبقى)", "`/jail appeal @عضو <الحالة>`: استئناف (يرجع نقاط المستوى)", "`/jail list @عضو`: كل حالات السجن"].join("\n") },
        { name: "إجراءات السيرفر", value: ["`/ban @عضو [السبب]`: باند من السيرفر", "`/unban <آيدي> [السبب]`: فك الباند", "`/kick @عضو [السبب]`: طرد من السيرفر"].join("\n") },
        { name: "الرتب", value: ["`/roles`: كل رتب السيرفر", "`/role give @عضو <رتبة>`: إعطاء رتبة", "`/role remove @عضو <رتبة>`: سحب رتبة", "`/role multirole @عضو <رتبة1> … [رتبة5]`: إعطاء أكثر من رتبة", "ما تقدر تعطي رتبة أعلى من رتبتك أو تساويها."].join("\n") },
        { name: "الأسباب", value: ["`/reason create <النوع>`: إضافة سبب عقوبة (Manager+)", "`/reason remove <المفتاح>`: حذف سبب (Manager+)", "`/reason list`: كل الأسباب"].join("\n") },
        { name: "مستويات العقوبة", value: ["كل عقوبة تزيد مستوى العضو:", "• **تحذير** +5 · **ميوت** +10 · **باند** +20", "", "**عند المستوى:** `20` رتبة تحذير · `40` رتبة إنذار نهائي · `60` ميوت تلقائي · `80` باند مؤقت · `100` باند دائم", "", "عقوبات المشرفين الجدد تروح لمشرف أعلى للموافقة."].join("\n") },
    ],
});
