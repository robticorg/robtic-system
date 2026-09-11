import { ChannelType } from "discord.js";
import { defineFeature } from "@typings/feature";
import { QUEST_TIERS, QUEST_LIMITS } from "@constants";

const TIER_CHOICES = QUEST_TIERS.map(tier => ({ name: tier, value: tier }));

/**
 * Quests.
 *
 * `opt-in`: a quest engine posts messages, pings roles and hands out currency on its own schedule.
 * That is not something a server should discover the bot doing — unlike points or XP, which only
 * count what was already happening.
 */
export const questsFeature = defineFeature({
    key: "quests",
    description: "مهام يومية، تحديات نادرة، وهدف أسبوعي للكوميونتي",
    activation: "opt-in",
    events: ["clientReady", "guildDelete"],
    components: ["quest"],
    commands: [
        {
            name: "quest",
            description: "مهامك، لوحة المهام، ووش وضعك فيها",
            scope: "guild",
            access: "general",
            category: "Activity",
            subcommands: [
                { name: "board", description: "كل المهام اللي تقدر تطالب فيها الحين" },
                { name: "active", description: "المهام اللي شغال عليها" },
                { name: "community", description: "تحدي الكوميونتي لهالأسبوع" },
                {
                    name: "stats",
                    description: "سجل المهام لك أو لعضو ثاني",
                    options: [{ name: "user", description: "العضو اللي تبي تتأكد منه (لك أنت افتراضيًا)", type: "user" }],
                },
                { name: "top", description: "الأعضاء اللي عندهم أكثر مهام مكتملة" },
                {
                    name: "post",
                    description: "انشر مهمة خاصة الحين (بس لأدمن السيرفر)",
                },
            ],
        },
        {
            name: "quest-config",
            description: "إعداد نظام المهام",
            scope: "guild",
            access: "admin",
            category: "Configuration",
            groups: [
                {
                    name: "channel",
                    description: "وين تُنشر المهام",
                    subcommands: [
                        {
                            name: "quest",
                            description: "التشانل لكل المهام — سهلة، عادية، صعبة، ذهبية و VIP",
                            options: [{ name: "channel", description: "التشانل المطلوب", type: "channel", required: true, channelTypes: [ChannelType.GuildText] }],
                        },
                        {
                            name: "community",
                            description: "التشانل لتحدي الكوميونتي الأسبوعي",
                            options: [{ name: "channel", description: "التشانل المطلوب", type: "channel", required: true, channelTypes: [ChannelType.GuildText] }],
                        },
                    ],
                },
                {
                    name: "mention",
                    description: "الرول اللي يتم منشنه لما تنشر مهمة",
                    subcommands: [
                        {
                            name: "set",
                            description: "حدد الرول اللي يتمنشن لنوع مهمة معين",
                            options: [
                                {
                                    name: "type",
                                    description: "أي نوع مهمة",
                                    type: "string",
                                    required: true,
                                    choices: [...TIER_CHOICES, { name: "community", value: "community" }],
                                },
                                { name: "role", description: "الرول اللي يتمنشن (سيبه فاضي عشان تلغيه)", type: "role" },
                            ],
                        },
                        { name: "list", description: "اعرض كل رولات المنشن المعدّلة" },
                    ],
                },
                {
                    name: "vip-role",
                    description: "الرولات اللي تقدر تطالب بمهام VIP",
                    subcommands: [
                        {
                            name: "add",
                            description: "خلي رول يقدر يطالب بمهام VIP",
                            options: [{ name: "role", description: "الرول اللي تبي تسمح له", type: "role", required: true }],
                        },
                        {
                            name: "remove",
                            description: "امنع رول من المطالبة بمهام VIP",
                            options: [{ name: "role", description: "الرول اللي تبي تشيله", type: "role", required: true }],
                        },
                        { name: "list", description: "اعرض رولات VIP" },
                    ],
                },
                {
                    name: "window",
                    description: "أوقات اليوم اللي ممكن تطلع فيها المهام",
                    subcommands: [
                        {
                            name: "add",
                            description: "ضيف أو غيّر فترة توليد",
                            options: [
                                { name: "key", description: "اسم الفترة، مثلاً morning", type: "string", required: true },
                                { name: "start-hour", description: "الساعة المحلية اللي تبدأ فيها (0-23)", type: "integer", required: true, minValue: QUEST_LIMITS.windowHour.min, maxValue: QUEST_LIMITS.windowHour.max },
                                { name: "end-hour", description: "الساعة المحلية اللي تخلص فيها (0-23)", type: "integer", required: true, minValue: QUEST_LIMITS.windowHour.min, maxValue: QUEST_LIMITS.windowHour.max },
                            ],
                        },
                        {
                            name: "remove",
                            description: "احذف فترة",
                            options: [{ name: "key", description: "اسم الفترة", type: "string", required: true, autocomplete: true }],
                        },
                        { name: "list", description: "اعرض الفترات وتوقيت السيرفر" },
                    ],
                },
                {
                    name: "tier",
                    description: "شغّل أو أوقف نوع مهمة معين",
                    subcommands: [
                        {
                            name: "toggle",
                            description: "فعّل أو عطّل نوع مهمة بهذا السيرفر",
                            options: [
                                { name: "type", description: "أي نوع مهمة", type: "string", required: true, choices: TIER_CHOICES },
                                { name: "enabled", description: "تبي تتولد ولا لا", type: "boolean", required: true },
                            ],
                        },
                    ],
                },
            ],
            subcommands: [
                {
                    name: "offset",
                    description: "توقيت السيرفر، بالدقايق من UTC (مثلاً 180 لتوقيت +3، 330 لتوقيت +5:30)",
                    options: [
                        {
                            name: "minutes",
                            description: "عدد الدقايق شرق UTC",
                            type: "integer",
                            required: true,
                            minValue: QUEST_LIMITS.utcOffsetMinutes.min,
                            maxValue: QUEST_LIMITS.utcOffsetMinutes.max,
                        },
                    ],
                },
                {
                    name: "community",
                    description: "إعدادات التحدي الأسبوعي",
                    options: [
                        { name: "enabled", description: "هل يفتح تحدي كل أسبوع", type: "boolean" },
                        { name: "reward", description: "النقاط الأساسية اللي تنعطى لكل مساهم مؤهل", type: "integer", minValue: QUEST_LIMITS.communityRewardBase.min, maxValue: QUEST_LIMITS.communityRewardBase.max },
                        { name: "minimum", description: "أقل مساهمة عشان تستحق المكافأة", type: "integer", minValue: QUEST_LIMITS.communityMinContribution.min, maxValue: QUEST_LIMITS.communityMinContribution.max },
                    ],
                },
                { name: "status", description: "اعرض كل إعدادات نظام المهام" },
            ],
        },
    ],
});
