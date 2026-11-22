import {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    type ChatInputCommandInteraction,
    type ImageURLOptions,
} from "discord.js";
import { COLORS } from "@constants";
import { L } from "@utils";

type Kind = "user" | "server";
type Which = "avatar" | "banner";

const SIZE: ImageURLOptions = { size: 4096, extension: "png", forceStatic: false };

/** Download links in each format Discord serves; GIF only when the picture moves. */
function links(url: (o: ImageURLOptions) => string | null, animated: boolean) {
    const formats: ImageURLOptions["extension"][] = ["png", "jpg", "webp", ...(animated ? (["gif"] as const) : [])];
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        formats.flatMap(ext => {
            const href = url({ size: 4096, extension: ext, forceStatic: ext !== "gif" });
            return href ? [new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(ext!.toUpperCase()).setURL(href)] : [];
        }),
    );
}

/**
 * /avatar type:user|server which:avatar|banner user:
 * A member's (or the server's) avatar or banner, full size, with download links. For a member, their server profile
 * picture is shown when they set one, with their main one linked too. Anyone can use it.
 */
export default {
    scope: "guild",
    category: "General",
    data: new SlashCommandBuilder()
        .setName("avatar")
        .setDescription("Show a member's or the server's avatar or banner")
        .addStringOption(opt => opt.setName("type").setDescription("A member or the server").setRequired(true)
            .addChoices({ name: "User", value: "user" }, { name: "Server", value: "server" }))
        .addStringOption(opt => opt.setName("which").setDescription("Avatar or banner (default: avatar)").setRequired(false)
            .addChoices({ name: "Avatar", value: "avatar" }, { name: "Banner", value: "banner" }))
        .addUserOption(opt => opt.setName("user").setDescription("Whose (default: you). Ignored for the server.").setRequired(false)),

    async run(interaction: ChatInputCommandInteraction) {
        const guild = interaction.guild;
        if (!guild) return void await interaction.reply({ content: L("Use this in a server.", "استخدم الأمر داخل سيرفر."), flags: MessageFlags.Ephemeral });
        const kind = interaction.options.getString("type", true) as Kind;
        const which = (interaction.options.getString("which") ?? "avatar") as Which;
        const none = (text: string) => interaction.reply({ content: text, flags: MessageFlags.Ephemeral });

        if (kind === "server") {
            const fresh = await guild.fetch().catch(() => guild);
            const url = (o: ImageURLOptions) => (which === "avatar" ? fresh.iconURL(o) : fresh.bannerURL(o));
            const hash = which === "avatar" ? fresh.icon : fresh.banner;
            if (!hash) return void await none(which === "avatar" ? L("This server has no icon.", "السيرفر ما عنده صورة.") : L("This server has no banner.", "السيرفر ما عنده بنر."));
            const embed = new EmbedBuilder()
                .setColor(COLORS.default)
                .setTitle(which === "avatar" ? L(`${fresh.name}'s icon`, `صورة ${fresh.name}`) : L(`${fresh.name}'s banner`, `بنر ${fresh.name}`))
                .setImage(url(SIZE));
            return void await interaction.reply({ embeds: [embed], components: [links(url, hash.startsWith("a_"))] });
        }

        const target = interaction.options.getUser("user") ?? interaction.user;
        // Banners and accent colours only come with a forced fetch.
        const user = await interaction.client.users.fetch(target.id, { force: true }).catch(() => target);
        const member = await guild.members.fetch(target.id).catch(() => null);

        if (which === "banner") {
            const serverBanner = member?.banner ? (o: ImageURLOptions) => member.bannerURL(o) : null;
            const url = serverBanner ?? ((o: ImageURLOptions) => user.bannerURL(o) ?? null);
            const hash = member?.banner ?? user.banner;
            if (!hash) return void await none(L(`${user.username} has no banner.`, `${user.username} ما عنده بنر.`));
            const embed = new EmbedBuilder()
                .setColor(user.accentColor ?? COLORS.default)
                .setTitle(L(`${member?.displayName ?? user.username}'s banner`, `بنر ${member?.displayName ?? user.username}`))
                .setImage(url(SIZE));
            return void await interaction.reply({ embeds: [embed], components: [links(url, hash.startsWith("a_"))] });
        }

        // The server profile picture when they set one; otherwise their main avatar.
        const serverAvatar = member?.avatar ? (o: ImageURLOptions) => member.avatarURL(o) : null;
        const url = serverAvatar ?? ((o: ImageURLOptions) => user.displayAvatarURL(o));
        const hash = member?.avatar ?? user.avatar ?? "";
        const embed = new EmbedBuilder()
            .setColor(user.accentColor ?? COLORS.default)
            .setTitle(L(`${member?.displayName ?? user.username}'s avatar`, `صورة ${member?.displayName ?? user.username}`))
            .setImage(url(SIZE));
        if (serverAvatar) embed.setDescription(L(`Server profile picture · [main avatar](${user.displayAvatarURL(SIZE)})`, `صورة البروفايل في السيرفر · [الصورة الأساسية](${user.displayAvatarURL(SIZE)})`));
        await interaction.reply({ embeds: [embed], components: [links(url, hash.startsWith("a_"))] });
    },
};
