import {
    AttachmentBuilder,
    MediaGalleryBuilder,
    SectionBuilder,
    TextDisplayBuilder,
} from "discord.js";

export const LINE_IMAGE_NAME = "line.png";

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
 * The Components V2 message: a section holding the thank-you text, with the server icon as its
 * thumbnail, then `line.png` full width underneath. A section's accessory (button or thumbnail) is
 * required and sits beside the text, so the line goes in a media gallery below it rather than in
 * the section. Without a server icon the text is sent as a plain text display instead.
 *
 * No container, so it reads as message content rather than an embed-style card.
 */
export function buildBoostThanks(memberIds: readonly string[], emoji: string, serverIconUrl: string | null, line: Buffer | null) {
    const text = new TextDisplayBuilder().setContent(boostThanksMessage(memberIds, emoji));

    const head = serverIconUrl
        ? new SectionBuilder().addTextDisplayComponents(text).setThumbnailAccessory(thumb => thumb.setURL(serverIconUrl))
        : text;

    const components = line
        ? [head, new MediaGalleryBuilder().addItems(item => item.setURL(`attachment://${LINE_IMAGE_NAME}`))]
        : [head];

    return {
        components,
        files: line ? [new AttachmentBuilder(line, { name: LINE_IMAGE_NAME })] : [],
    };
}
