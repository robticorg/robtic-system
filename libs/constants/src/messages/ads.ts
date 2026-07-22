/** Price formatting for the ads/credits store. */
export const PRICING_MESSAGES = {
    priceWithCredits: (usd: number, credits: string) => `$${usd} • ${credits} Credits`,
} as const;
