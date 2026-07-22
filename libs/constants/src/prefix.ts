/** Fallback prefix for main-bot text commands when a guild hasn't set its own via /set-prefix. */
export const DEFAULT_PREFIX = "!";

/** Tokens accepted as `true` for boolean options in prefix commands. */
export const BOOLEAN_TRUE_TOKENS = ["true", "yes", "y", "1", "on"] as const;

/** Tokens accepted as `false` for boolean options in prefix commands. */
export const BOOLEAN_FALSE_TOKENS = ["false", "no", "n", "0", "off"] as const;
