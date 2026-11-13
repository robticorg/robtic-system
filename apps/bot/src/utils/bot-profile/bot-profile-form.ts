import {
    FileUploadBuilder,
    LabelBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    type Attachment,
    type Guild,
    type GuildMemberEditMeOptions,
    type ModalSubmitInteraction,
} from "discord.js";

import { L } from "@utils";
export const BOT_PROFILE_MODAL_ID = "bot-profile:config";

export const BOT_PROFILE_FIELDS = {
    avatar: "bot-profile-avatar",
    banner: "bot-profile-banner",
    nick: "bot-profile-nick",
    bio: "bot-profile-bio",
} as const;

/** Discord's limits for a server profile. */
const NICK_MAX = 32;
const BIO_MAX = 190;
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

/** The `/profile config` form: the bot's logo, banner, nickname and bio in this server only. */
export function buildBotProfileModal(currentNick: string | null): ModalBuilder {
    const nick = new TextInputBuilder()
        .setCustomId(BOT_PROFILE_FIELDS.nick)
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(NICK_MAX);
    if (currentNick) nick.setValue(currentNick);

    return new ModalBuilder()
        .setCustomId(BOT_PROFILE_MODAL_ID)
        .setTitle(L("Bot profile in this server", "بروفايل البوت في السيرفر"))
        .addLabelComponents(
            new LabelBuilder()
                .setLabel(L("Logo", "الصورة"))
                .setDescription(L("PNG, JPG, GIF or WEBP, up to 10 MB. Leave empty to keep the current one.", "PNG أو JPG أو GIF أو WEBP، حتى 10 ميقا. اتركه فاضي للإبقاء على الحالي."))
                .setFileUploadComponent(new FileUploadBuilder()
                    .setCustomId(BOT_PROFILE_FIELDS.avatar)
                    .setRequired(false)
                    .setMaxValues(1)),
            new LabelBuilder()
                .setLabel(L("Banner", "البنر"))
                .setDescription(L("PNG, JPG, GIF or WEBP, up to 10 MB. Leave empty to keep the current one.", "PNG أو JPG أو GIF أو WEBP، حتى 10 ميقا. اتركه فاضي للإبقاء على الحالي."))
                .setFileUploadComponent(new FileUploadBuilder()
                    .setCustomId(BOT_PROFILE_FIELDS.banner)
                    .setRequired(false)
                    .setMaxValues(1)),
            new LabelBuilder()
                .setLabel(L("Nickname", "اللقب"))
                .setDescription(L("Its name in this server. Clear it to go back to the bot's own name.", "اسمه في السيرفر. امسحه لترجع لاسم البوت الأصلي."))
                .setTextInputComponent(nick),
            new LabelBuilder()
                .setLabel(L("Bio", "النبذة"))
                .setDescription(L("Its About Me in this server. Leave empty to keep the current one.", "النبذة في السيرفر. اتركها فاضية للإبقاء على الحالية."))
                .setTextInputComponent(new TextInputBuilder()
                    .setCustomId(BOT_PROFILE_FIELDS.bio)
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(false)
                    .setMaxLength(BIO_MAX)),
        );
}

export type BotProfileResult =
    | { ok: true; changed: string[] }
    | { ok: false; problem: string };

function imageProblem(file: Attachment, what: string): string | null {
    if (!file.contentType || !IMAGE_TYPES.has(file.contentType.split(";")[0]!.trim())) {
        return L(`The ${what} must be a PNG, JPG, GIF or WEBP image.`, `${what === "logo" ? "الصورة" : "البنر"} لازم تكون PNG أو JPG أو GIF أو WEBP.`);
    }
    if (file.size > IMAGE_MAX_BYTES) return L(`The ${what} is bigger than 10 MB.`, `${what === "logo" ? "الصورة" : "البنر"} أكبر من 10 ميقا.`);
    return null;
}

/** Applies the submitted form to the bot's profile in this server only; untouched fields stay as they are. */
export async function applyBotProfile(guild: Guild, interaction: ModalSubmitInteraction): Promise<BotProfileResult> {
    const avatar = interaction.fields.getUploadedFiles(BOT_PROFILE_FIELDS.avatar)?.first() ?? null;
    const banner = interaction.fields.getUploadedFiles(BOT_PROFILE_FIELDS.banner)?.first() ?? null;
    const nick = interaction.fields.getTextInputValue(BOT_PROFILE_FIELDS.nick).trim();
    const bio = interaction.fields.getTextInputValue(BOT_PROFILE_FIELDS.bio).trim();

    for (const [file, what] of [[avatar, "logo"], [banner, "banner"]] as const) {
        const problem = file && imageProblem(file, what);
        if (problem) return { ok: false, problem };
    }

    const me = guild.members.me ?? await guild.members.fetchMe();
    const changes: GuildMemberEditMeOptions = {};
    const changed: string[] = [];

    if (avatar) { changes.avatar = avatar.url; changed.push("logo"); }
    if (banner) { changes.banner = banner.url; changed.push("banner"); }
    if ((nick || null) !== me.nickname) { changes.nick = nick || null; changed.push("nickname"); }
    if (bio) { changes.bio = bio; changed.push("bio"); }

    if (!changed.length) return { ok: true, changed };

    try {
        await guild.members.editMe({ ...changes, reason: `Bot profile set by ${interaction.user.tag}` });
        return { ok: true, changed };
    } catch (err) {
        return { ok: false, problem: `Discord refused the change: ${(err as Error).message}` };
    }
}
