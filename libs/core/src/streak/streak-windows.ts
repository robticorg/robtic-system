import { STREAK_CONFIG, DAY_MS } from "@constants";

/** Claim/expiry windows expressed in whole UTC calendar days, derived from STREAK_CONFIG. */
export const CLAIM_DAYS = Math.max(1, Math.round(STREAK_CONFIG.claimWindowMs / DAY_MS));
export const EXPIRE_DAYS = Math.max(1, Math.round(STREAK_CONFIG.expireWindowMs / DAY_MS));
