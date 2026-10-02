import {
    AttachmentBuilder,
    MediaGalleryBuilder,
    TextDisplayBuilder,
} from "discord.js";
import type { LineImage } from "@core/assets";

/**
 * The thank-you text, exactly as worded: every booster's mention on one line (`@a, @b, @c`), then
 * the Arabic line in bold and the English one as small text, each ending with the emoji. Pure, so
 * the wording is testable.
 */
export function boostThanksMessage(memberIds: readonly string[], emoji: string): string {
    const tail = emoji ? ` ${emoji}` : "";
    return [
        memberIds.map(id => `<@${id}>`).join(", "),
        `**شكراً لدعمك لروبيتك وتعزيزك للسيرفر، دعمك يعني لنا الكثير ويساعدنا على الاستمرار والتطور${tail}**`,
        `-# Thank you for supporting Robtic and boosting the server, your support means a lot and helps us keep growing${tail}`,
    ].join("\n");
}

/**
 * The Components V2 message: the thank-you text, then the line image (`/setline`) full width
 * underneath. Nothing beside the text, and no container, so it reads as plain message content
 * rather than an embed-style card.
 */
export function buildBoostThanks(memberIds: readonly string[], emoji: string, line: LineImage | null) {
    const text = new TextDisplayBuilder().setContent(boostThanksMessage(memberIds, emoji));

    const components = line
        ? [text, new MediaGalleryBuilder().addItems(item => item.setURL(`attachment://${line.name}`))]
        : [text];

    return {
        components,
        files: line ? [new AttachmentBuilder(line.data, { name: line.name })] : [],
    };
}
