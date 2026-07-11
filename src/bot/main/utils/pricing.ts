export function creditsFor(usd: number, rate: number): number {
    return Math.round(usd * rate);
}

export function formatPrice(usd: number, rate: number): string {
    return `$${usd} • ${creditsFor(usd, rate).toLocaleString()} Credits`;
}
