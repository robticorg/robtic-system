/** Matches custom Discord emojis and unicode emoji ranges. */
export const EMOJI_REGEX = /<a?:\w+:\d+>|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}️‍]/gu;

/** First non-whitespace char being a symbol/punctuation covers any bot's command prefix generically, without hardcoding a prefix list. */
export const FIRST_CHAR_ALNUM_REGEX = /^[\p{L}\p{N}]/u;

/** A raw Discord snowflake id. */
export const SNOWFLAKE_REGEX = /^\d{15,25}$/;

/** `<@123>` / `<@!123>` user mention; capture group 1 is the id. */
export const USER_MENTION_REGEX = /^<@!?(\d+)>$/;

/** `<@&123>` role mention; capture group 1 is the id. */
export const ROLE_MENTION_REGEX = /^<@&(\d+)>$/;

/** `<#123>` channel mention; capture group 1 is the id. */
export const CHANNEL_MENTION_REGEX = /^<#(\d+)>$/;

/** Splits text on runs of whitespace, for word counting. */
export const WHITESPACE_SPLIT_REGEX = /\s+/;

/** Permissive http(s) URL check used to sanitize user-submitted project links. */
export const GENERIC_URL_REGEX = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w- ./?%&=]*)?$/;

/** A youtube.com or youtu.be video link. */
export const YOUTUBE_URL_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;

/** A github.com repository or user link. */
export const GITHUB_URL_REGEX = /^(https?:\/\/)?(www\.)?github\.com\/[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*\/?$/;
