import { escapeMarkdown } from "discord.js";
import { BP_SCALE } from "@constants";
import type { ReferralApplyDecision, ReferralCodeSnapshot } from "@core/rewards";

import { L } from "@utils";
/** Basis points → "10%" / "12.5%". */
export function formatReferralPercent(bp: number): string {
    const percent = Math.max(0, bp) / (BP_SCALE / 100);
    return `${Number.isInteger(percent) ? percent : percent.toFixed(2).replace(/0+$/, "")}%`;
}

const code = (c: ReferralCodeSnapshot | null) => `**${escapeMarkdown(c?.code ?? "")}**`;

/** The reply to `/referral use`, for each outcome. */
export function applyDecisionMessage(decision: ReferralApplyDecision, snapshot: ReferralCodeSnapshot | null, bonusBp: number): string {
    switch (decision) {
        case "applied":
            return L(`Referral code ${code(snapshot)} applied: you now get **+${formatReferralPercent(bonusBp)}** on every reward.`, `تم تطبيق كود الإحالة ${code(snapshot)}: صار لك **+${formatReferralPercent(bonusBp)}** على كل مكافأة.`);
        case "invalid":
            return L("That isn't a valid referral code. Codes are 3–20 letters, numbers, `-` or `_`.", "هذا ليس كود إحالة صحيح. الكود من 3 إلى 20 حرف إنجليزي أو رقم أو `-` أو `_`.");
        case "not-found":
            return L("No referral code with that name exists here.", "ما في كود إحالة بهذا الاسم هنا.");
        case "inactive":
            return L(`The code ${code(snapshot)} isn't active right now.`, `الكود ${code(snapshot)} غير فعال الحين.`);
        case "own-code":
            return L("You can't use your own referral code.", "ما تقدر تستخدم كود الإحالة حقك.");
        case "already-linked":
            return L(`You already use the code ${code(snapshot)}. Ask staff if it needs to be changed.`, `تستخدم الكود ${code(snapshot)} من قبل. اطلب من الإدارة إذا تبي تغيره.`);
    }
}
