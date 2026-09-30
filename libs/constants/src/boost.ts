/** The boost thank-you (`/boost channel`). */
export const BOOST_CONFIG = {
    /**
     * Custom emoji at the end of both lines, looked up by name in the server (then the bot's own
     * application emojis) when the message is sent. Left out if neither has it.
     */
    emojiName: "CrystalSub",
    /**
     * Discord can report one boost twice — the "just boosted" system message and the member's
     * `premiumSince` changing. Thanks for the same member inside this window are sent once.
     */
    dedupeWindowMs: 5 * 60_000,
} as const;
