import { Schema, model, type Document } from "mongoose";

/**
 * One partner server, as posted by `/partner add` in one of our guilds.
 *
 * A new collection (`partnerservers`), not the retired `Partner` model: that one is dropped by
 * `scripts/drop-removed-features.ts`, and this feature must survive that script.
 *
 * The partner's image is kept here (shrunk to at most 512px, PNG) rather than as a link, so the
 * Information panel still shows it after the uploader's attachment URL expires. `messageId` points
 * at the banner post, so removing a partner also takes the post down.
 */
export interface IPartnerServer extends Document {
    guildId: string;
    name: string;
    inviteUrl: string;
    /** The partner server's representative. */
    representativeId: string;
    description: string;
    image: Buffer;
    channelId: string | null;
    messageId: string | null;
    addedBy: string;
    createdAt: Date;
    updatedAt: Date;
}

const partnerServerSchema = new Schema<IPartnerServer>(
    {
        guildId: { type: String, required: true, index: true },
        name: { type: String, required: true },
        inviteUrl: { type: String, required: true },
        representativeId: { type: String, required: true },
        description: { type: String, required: true },
        image: { type: Buffer, required: true },
        channelId: { type: String, default: null },
        messageId: { type: String, default: null },
        addedBy: { type: String, required: true },
    },
    { timestamps: true }
);

partnerServerSchema.index({ guildId: 1, name: 1 });

export const PartnerServer = model<IPartnerServer>("PartnerServer", partnerServerSchema);
