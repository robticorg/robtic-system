/** Embed accent colors used across every bot module. */
export const COLORS = {
    default: 0x5865F2,
    success: 0x4CAF50,
    error: 0xFF4C4C,
    info: 0x3498DB,
    warning: 0xFFC107,
    moderation: 0xE74C3C,
    ticket: 0x9B59B6,
    hr: 0xF39C12,
    activity: 0x2ECC71,
} as const;

export type ColorKey = keyof typeof COLORS;
