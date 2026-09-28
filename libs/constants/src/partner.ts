/** The partner feature (`/partner`): the banner template, where the partner's image goes, and the post's buttons. */
export const PARTNER_CONFIG = {
    /** Template banner, relative to the repo root. Our logo is already on its left panel. */
    templatePath: ["images", "partner.png"] as const,
    /**
     * Where the partner's image is drawn, in the template's own pixels (4500×1217): centred on the
     * empty right panel, the same size as our logo on the left. The image is fitted inside this
     * square, keeping its proportions.
     */
    slot: { centerX: 3400, centerY: 603, size: 560, cornerRadius: 70 },
    /** The banner is posted at this fraction of the template's size — the full-size PNG is ~8MB. */
    outputScale: 0.5,
    /** The partner's image is stored at most this wide/tall, so every row stays small. */
    storedImageMaxSize: 512,
    /** Largest upload accepted for the partner image, in bytes. */
    maxUploadBytes: 8 * 1024 * 1024,
    beAPartnerUrl: "https://discord.com/channels/1293702554663784561/1536249118681210953",
    emojis: {
        info: { id: "1480426659747463242", name: "info" },
        robtic: { id: "1554110324167286894", name: "robtic" },
    },
    limits: {
        name: 100,
        inviteUrl: 200,
        description: 1000,
    },
} as const;
