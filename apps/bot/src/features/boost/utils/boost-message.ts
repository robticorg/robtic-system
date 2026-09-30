/**
 * The thank-you, exactly as worded: the booster's mention, then the Arabic line in bold and the
 * English one as small text, each ending with the emoji. Pure, so the wording is testable.
 */
export function boostThanksMessage(memberId: string, emoji: string): string {
    const tail = emoji ? ` ${emoji}` : "";
    return [
        `<@${memberId}>`,
        `**شكراً لدعمك لروبيتك وتعزيزك للسيرفر، دعمك يعني لنا الكثير ويساعدنا على الاستمرار والتطور${tail}**`,
        `-# Thank you for supporting Robtic and boosting the server, your support means a lot and helps us keep growing${tail}`,
    ].join("\n");
}
