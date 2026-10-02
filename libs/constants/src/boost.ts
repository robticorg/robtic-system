/** The boost thank-you (`/boost channel`). */
export const BOOST_CONFIG = {
    /**
     * Custom emoji at the end of both lines, looked up by name in the server (then the bot's own
     * application emojis) when the message is sent. Left out if neither has it.
     */
    emojiName: "CrystalSub",
    /**
     * Boosts are thanked together: every boost restarts this wait, and once no boost has arrived for
     * this long, everyone who boosted in the meantime is thanked in one message.
     */
    batchQuietMs: 30 * 60_000,
    /** Most members mentioned in one thank-you; a larger batch is split over several messages. */
    maxMentionsPerMessage: 50,
} as const;
