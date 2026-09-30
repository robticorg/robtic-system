import { escapeMarkdown } from "discord.js";
import { BP_SCALE } from "@constants";
import type { ReferralApplyDecision, ReferralCodeSnapshot } from "@core/rewards";

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
            return `Referral code ${code(snapshot)} applied — you now get **+${formatReferralPercent(bonusBp)}** on every reward.`;
        case "invalid":
            return "That isn't a valid referral code. Codes are 3–20 letters, numbers, `-` or `_`.";
        case "not-found":
            return "No referral code with that name exists here.";
        case "inactive":
            return `The code ${code(snapshot)} isn't active right now.`;
        case "own-code":
            return "You can't use your own referral code.";
        case "already-linked":
            return `You already use the code ${code(snapshot)}. Ask staff if it needs to be changed.`;
    }
}
