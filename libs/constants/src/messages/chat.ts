import { bilingual } from "@utils/lang-context";

/** Replies from `/chat` and the channel-utility shortcuts behind it. */
export const CHAT_MESSAGES = bilingual({
    guildChannelOnly: "This command can only be used in a server channel.",
    unknownSubcommand: "Unknown subcommand.",
    actionFailed: "Something went wrong running that. Check my permissions in this channel.",
}, {
    guildChannelOnly: "هذا الأمر يعمل داخل روم في السيرفر فقط.",
    unknownSubcommand: "أمر فرعي غير معروف.",
    actionFailed: "صار خطأ أثناء التنفيذ. تأكد من صلاحياتي في هذا الروم.",
});
