import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    type ButtonInteraction,
    type User,
} from "discord.js";
import type { ComponentHandler } from "@core/config";
import { Colors } from "@core/config";
import { UserRepository } from "@database/repositories";
import { t, type Lang } from "@shared/utils/lang";

export function buildProfileSettingsRow(userId: string, lang: Lang): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`profile_settings_lang_en_${userId}`)
            .setLabel(t("settings.button_lang_en", lang))
            .setStyle(ButtonStyle.Primary)
            .setDisabled(lang === "en"),
        new ButtonBuilder()
            .setCustomId(`profile_settings_lang_ar_${userId}`)
            .setLabel(t("settings.button_lang_ar", lang))
            .setStyle(ButtonStyle.Primary)
            .setDisabled(lang === "ar"),
        new ButtonBuilder()
            .setCustomId(`profile_settings_edit_name_${userId}`)
            .setLabel(t("settings.button_edit_name", lang))
            .setStyle(ButtonStyle.Secondary),
    );
}

export async function buildSettingsEmbed(user: User, lang: Lang): Promise<EmbedBuilder> {
    const displayName = await UserRepository.getDisplayName(user.id);
    return new EmbedBuilder()
        .setTitle(`⚙️ ${t("settings.title", lang, { user: user.username })}`)
        .addFields(
            { name: t("settings.language_field", lang), value: lang === "ar" ? "العربية" : "English", inline: true },
            { name: t("settings.display_name_field", lang), value: displayName ?? t("settings.display_name_unset", lang), inline: true },
        )
        .setColor(Colors.default);
}

const profileSettingsLangHandler: ComponentHandler<ButtonInteraction> = {
    customId: /^profile_settings_lang_(en|ar)_\d+$/,

    async run(interaction: ButtonInteraction) {
        const parts = interaction.customId.split("_");
        const newLang = parts[3] as Lang;
        const userId = parts[4];

        if (interaction.user.id !== userId) {
            await interaction.reply({ content: "This isn't your settings panel.", flags: MessageFlags.Ephemeral }).catch(() => null);
            return;
        }

        await UserRepository.setPreferredLang(userId, interaction.user.username, newLang);

        const embed = await buildSettingsEmbed(interaction.user, newLang);
        await interaction.update({ embeds: [embed], components: [buildProfileSettingsRow(userId, newLang)] });
    },
};

export const profileSettingsEditNameHandler: ComponentHandler<ButtonInteraction> = {
    customId: /^profile_settings_edit_name_\d+$/,

    async run(interaction: ButtonInteraction) {
        const userId = interaction.customId.replace("profile_settings_edit_name_", "");

        if (interaction.user.id !== userId) {
            await interaction.reply({ content: "This isn't your settings panel.", flags: MessageFlags.Ephemeral }).catch(() => null);
            return;
        }

        const modal = new ModalBuilder()
            .setCustomId(`profile_settings_name_modal_${userId}`)
            .setTitle("Edit Display Name");

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId("display_name")
                    .setLabel("Display Name")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(32)
                    .setPlaceholder("How the bot should refer to you"),
            ),
        );

        await interaction.showModal(modal);
    },
};

export default profileSettingsLangHandler;
