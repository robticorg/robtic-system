import {
    AttachmentBuilder,
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    MessageFlags,
} from "discord.js";
import { getLineImage, lineFileName, resetLineImage, setLineImage } from "@core/assets";
import { Logger } from "@logger";

import { L } from "@utils";
/** Mongo documents stop at 16 MB; 8 MB leaves room and matches Discord's default upload limit. */
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * `/setline` — sets the separator line image for this whole branch (this bot): the line channels,
 * the activity panel and boost thank-yous all use it from the next message on. `reset:true` goes
 * back to the repository's `images/line.png`.
 */
export default {
    scope: "guild",
    category: "Configuration",
    data: new SlashCommandBuilder()
        .setName("setline")
        .setDescription("Set the line image this bot uses everywhere")
        .addAttachmentOption(opt =>
            opt.setName("image").setDescription("The new line image (PNG, JPG, GIF or WEBP)")
        )
        .addBooleanOption(opt =>
            opt.setName("reset").setDescription("Go back to the default line from images/line.png")
        ),

    requiredPermission: 100,
    /** Slash only: an image upload can't be typed after a `!` prefix, so `!setline` is refused with a clear message. */
    modalOnly: true,

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (interaction.options.getBoolean("reset")) {
            const removed = await resetLineImage();
            await interaction.editReply({ content: removed ? L("The line is back to the default `images/line.png`.", "رجع الخط للافتراضي `images/line.png`.") : L("The default line is already in use.", "الخط الافتراضي مستخدم من قبل.") });
            return;
        }

        const upload = interaction.options.getAttachment("image");
        if (!upload) {
            const current = await getLineImage();
            await interaction.editReply({
                content: current ? L("This is the line in use now. Run `/setline image:` with a new one to change it.", "هذا الخط المستخدم الحين. استخدم `/setline image:` بصورة جديدة لتغييره.") : L("No line image is set.", "ما في صورة خط محددة."),
                files: current ? [new AttachmentBuilder(current.data, { name: current.name })] : [],
            });
            return;
        }

        const fileName = lineFileName(upload.contentType ?? "");
        if (!fileName) {
            await interaction.editReply({ content: L("The line must be an image: PNG, JPG, GIF or WEBP.", "الخط لازم يكون صورة: PNG أو JPG أو GIF أو WEBP.") });
            return;
        }
        if (upload.size > MAX_BYTES) {
            await interaction.editReply({ content: L("That image is too large: 8 MB at most.", "الصورة كبيرة: الحد 8 ميقا.") });
            return;
        }

        let data: Buffer;
        try {
            const response = await fetch(upload.url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            data = Buffer.from(await response.arrayBuffer());
        } catch (err) {
            Logger.warn(`Could not download the new line image: ${err}`, "setline");
            await interaction.editReply({ content: L("I couldn't download that image. Try again.", "ما قدرت أحمل الصورة. حاول مرة ثانية.") });
            return;
        }

        await setLineImage(data, upload.contentType!, fileName, interaction.user.id);
        await interaction.editReply({
            content: L("Line updated. Line channels, the activity panel and boost thank-yous use it from now on.", "تم تحديث الخط. رومات الخط ولوحة النشاط وشكر البوست بتستخدمه من الحين."),
            files: [new AttachmentBuilder(data, { name: fileName })],
        });
    },
};
