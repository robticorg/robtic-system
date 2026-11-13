import { bilingual } from "@utils/lang-context";

/** Every log destination configurable via /setup-log, keyed by the identifier stored in LogConfig. */
const LOG_REGISTRY_EN = {
    guard_log: { label: "Security log", description: "Security and server guard events" },
    punishments_notice: { label: "Punishment notices", description: "Every executed punishment" },
    report: { label: "Reports", description: "Reports sent by members" },
    punishments_case: { label: "Punishment cases", description: "The punishment approval workflow" },
    appeals_case: { label: "Appeals", description: "Appeal cases" },
    xp_gain_log: { label: "XP log", description: "XP gains and level-ups" },
    rewards_log: { label: "Rewards log", description: "Rewards given out" },
    support_points_log: { label: "Support points log", description: "Support staff points" },
    decay_log: { label: "Inactivity log", description: "XP lost to inactivity" },
    ai_log: { label: "AI log", description: "AI decisions" },
};

export const LOG_REGISTRY = bilingual(LOG_REGISTRY_EN, {
    guard_log: { label: "لوق الحماية", description: "أحداث الحماية وحماية السيرفرات" },
    punishments_notice: { label: "إشعارات العقوبات", description: "كل عقوبة منفذة" },
    report: { label: "البلاغات", description: "بلاغات الأعضاء" },
    punishments_case: { label: "حالات العقوبات", description: "طلبات الموافقة على العقوبات" },
    appeals_case: { label: "الاستئنافات", description: "حالات الاستئناف" },
    xp_gain_log: { label: "لوق الخبرة", description: "الخبرة وترقيات المستوى" },
    rewards_log: { label: "لوق المكافآت", description: "المكافآت الموزعة" },
    support_points_log: { label: "لوق نقاط الدعم", description: "نقاط إداريين الدعم" },
    decay_log: { label: "لوق عدم النشاط", description: "الخبرة المفقودة بسبب عدم النشاط" },
    ai_log: { label: "لوق الذكاء الاصطناعي", description: "قرارات الذكاء الاصطناعي" },
});

export type LogKey = keyof typeof LOG_REGISTRY;
