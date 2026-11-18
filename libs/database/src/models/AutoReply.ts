import { Schema, model, type Document } from "mongoose";

/**
 * One auto reply rule for one guild: when a message matches a trigger, the bot answers with one of the replies.
 *
 * Written by the dashboard (robtic-discord, `libs/server/src/real/system.ts` → section `autoReplies`), read here.
 * The bot only writes `uses` / `lastUsedAt`. Field meanings match the dashboard's `AutoReplyRule`
 * (`libs/shared/src/autoreply.ts`), so keep the two in step.
 */
export type AutoReplyMatchMode = "exact" | "word" | "contains" | "starts" | "ends" | "regex";

export interface IAutoReplyAttachment {
    url: string;
    name: string;
    type: string;
    size: number;
}

export interface IAutoReplyVariant {
    text: string;
    weight: number;
    attachments: IAutoReplyAttachment[];
}

export interface IAutoReplyDoc extends Document {
    guildId: string;
    ruleId: string;
    position: number;
    enabled: boolean;
    advanced: boolean;
    triggers: string[];
    matchMode: AutoReplyMatchMode;
    replies: IAutoReplyVariant[];
    replyType: "reply" | "channel";
    allowedRoleIds: string[];
    caseSensitive: boolean;
    weighted: boolean;
    noRepeat: boolean;
    reaction: string;
    reactOnly: boolean;
    blockedRoleIds: string[];
    channelIds: string[];
    blockedChannelIds: string[];
    cooldowns: { userSeconds: number; channelSeconds: number; serverSeconds: number };
    chance: number;
    activeHours: { from: number; to: number } | null;
    priority: number;
    stopAfterMatch: boolean;
    deleteReplyAfter: number;
    deleteTrigger: boolean;
    uses: number;
    lastUsedAt: Date | null;
}

const attachmentSchema = new Schema<IAutoReplyAttachment>({ url: String, name: String, type: String, size: Number }, { _id: false });
const variantSchema = new Schema<IAutoReplyVariant>({ text: { type: String, default: "" }, weight: { type: Number, default: 1 }, attachments: { type: [attachmentSchema], default: [] } }, { _id: false });

const autoReplySchema = new Schema<IAutoReplyDoc>(
    {
        guildId: { type: String, required: true, index: true },
        ruleId: { type: String, required: true },
        position: { type: Number, default: 0 },
        enabled: { type: Boolean, default: true },
        advanced: { type: Boolean, default: false },
        triggers: { type: [String], default: [] },
        matchMode: { type: String, default: "word" },
        replies: { type: [variantSchema], default: [] },
        replyType: { type: String, default: "reply" },
        allowedRoleIds: { type: [String], default: [] },
        caseSensitive: { type: Boolean, default: false },
        weighted: { type: Boolean, default: false },
        noRepeat: { type: Boolean, default: false },
        reaction: { type: String, default: "" },
        reactOnly: { type: Boolean, default: false },
        blockedRoleIds: { type: [String], default: [] },
        channelIds: { type: [String], default: [] },
        blockedChannelIds: { type: [String], default: [] },
        cooldowns: {
            userSeconds: { type: Number, default: 0 },
            channelSeconds: { type: Number, default: 0 },
            serverSeconds: { type: Number, default: 0 },
        },
        chance: { type: Number, default: 100 },
        activeHours: { type: Schema.Types.Mixed, default: null },
        priority: { type: Number, default: 0 },
        stopAfterMatch: { type: Boolean, default: true },
        deleteReplyAfter: { type: Number, default: 0 },
        deleteTrigger: { type: Boolean, default: false },
        uses: { type: Number, default: 0 },
        lastUsedAt: { type: Date, default: null },
    },
    { timestamps: true, collection: "autoreplies" },
);

autoReplySchema.index({ guildId: 1, ruleId: 1 }, { unique: true });

export const AutoReply = model<IAutoReplyDoc>("AutoReply", autoReplySchema);
