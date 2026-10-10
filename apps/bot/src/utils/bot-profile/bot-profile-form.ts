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
        .setTitle("Bot Profile in This Server")
        .addLabelComponents(
            new LabelBuilder()
                .setLabel("Logo")
                .setDescription("PNG, JPG, GIF or WEBP, up to 10 MB. Leave empty to keep the current one.")
                .setFileUploadComponent(new FileUploadBuilder()
                    .setCustomId(BOT_PROFILE_FIELDS.avatar)
                    .setRequired(false)
                    .setMaxValues(1)),
            new LabelBuilder()
                .setLabel("Banner")
                .setDescription("PNG, JPG, GIF or WEBP, up to 10 MB. Leave empty to keep the current one.")
                .setFileUploadComponent(new FileUploadBuilder()
                    .setCustomId(BOT_PROFILE_FIELDS.banner)
                    .setRequired(false)
                    .setMaxValues(1)),
            new LabelBuilder()
                .setLabel("Nickname")
                .setDescription("Its name in this server. Clear it to go back to the bot's own name.")
                .setTextInputComponent(nick),
            new LabelBuilder()
                .setLabel("Bio")
                .setDescription("Its About Me in this server. Leave empty to keep the current one.")
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
        return `The ${what} must be a PNG, JPG, GIF or WEBP image.`;
    }
    if (file.size > IMAGE_MAX_BYTES) return `The ${what} is bigger than 10 MB.`;
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
