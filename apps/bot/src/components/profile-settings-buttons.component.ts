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
import type { ComponentHandler } from "@typings/command";
import { COLORS } from "@constants";
import { UserRepository } from "@database/repositories";
import { L, currentLang } from "@utils";
import { t, type Lang } from "@bot/utils/lang";

const NOT_YOURS = () => L("This isn't your settings panel.", "هذي لوحة إعدادات شخص ثاني.");

/**
 * The profile settings buttons: display name and privacy. The bot's language is the server's (dashboard → General),
 * so there is no language button here any more.
 */
export function buildProfileSettingsRow(userId: string, lang: Lang, privateProfile: boolean): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`profile_settings_edit_name_${userId}`)
            .setLabel(t("settings.button_edit_name", lang))
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`profile_settings_privacy_${userId}`)
            .setLabel(privateProfile ? t("settings.button_privacy_on", lang) : t("settings.button_privacy_off", lang))
            .setStyle(privateProfile ? ButtonStyle.Success : ButtonStyle.Secondary),
    );
}

export async function buildSettingsEmbed(user: User, lang: Lang): Promise<EmbedBuilder> {
    const displayName = await UserRepository.getDisplayName(user.id);
    const privateProfile = await UserRepository.getPrivateProfile(user.id);
    return new EmbedBuilder()
        .setTitle(`⚙️ ${t("settings.title", lang, { user: user.username })}`)
        .addFields(
            { name: t("settings.display_name_field", lang), value: displayName ?? t("settings.display_name_unset", lang), inline: true },
            { name: t("settings.private_profile_field", lang), value: privateProfile ? t("settings.private_profile_on", lang) : t("settings.private_profile_off", lang), inline: true },
        )
        .setColor(COLORS.default);
}

/** Language buttons on panels opened before the change: they point to the server setting instead. */
const profileSettingsLangHandler: ComponentHandler<ButtonInteraction> = {
    customId: /^profile_settings_lang_(en|ar)_\d+$/,

    async run(interaction: ButtonInteraction) {
        await interaction.reply({
            content: L("The bot's language is set for the whole server by an admin on the dashboard (General → Language).", "لغة البوت تنضبط للسيرفر كامل من لوحة التحكم (عام ← اللغة) بواسطة الإدارة."),
            flags: MessageFlags.Ephemeral,
        }).catch(() => null);
    },
};

export const profileSettingsPrivacyHandler: ComponentHandler<ButtonInteraction> = {
    customId: /^profile_settings_privacy_\d+$/,

    async run(interaction: ButtonInteraction) {
        const userId = interaction.customId.replace("profile_settings_privacy_", "");
        if (interaction.user.id !== userId) {
            await interaction.reply({ content: NOT_YOURS(), flags: MessageFlags.Ephemeral }).catch(() => null);
            return;
        }

        const newValue = !(await UserRepository.getPrivateProfile(userId));
        await UserRepository.setPrivateProfile(userId, interaction.user.username, newValue);

        const lang = currentLang();
        await interaction.update({ embeds: [await buildSettingsEmbed(interaction.user, lang)], components: [buildProfileSettingsRow(userId, lang, newValue)] });
    },
};

export const profileSettingsEditNameHandler: ComponentHandler<ButtonInteraction> = {
    customId: /^profile_settings_edit_name_\d+$/,

    async run(interaction: ButtonInteraction) {
        const userId = interaction.customId.replace("profile_settings_edit_name_", "");
        if (interaction.user.id !== userId) {
            await interaction.reply({ content: NOT_YOURS(), flags: MessageFlags.Ephemeral }).catch(() => null);
            return;
        }

        await interaction.showModal(
            new ModalBuilder()
                .setCustomId(`profile_settings_name_modal_${userId}`)
                .setTitle(L("Edit display name", "تعديل الاسم"))
                .addComponents(
                    new ActionRowBuilder<TextInputBuilder>().addComponents(
                        new TextInputBuilder()
                            .setCustomId("display_name")
                            .setLabel(L("Display name", "الاسم"))
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                            .setMaxLength(32)
                            .setPlaceholder(L("How the bot should call you", "كيف يناديك البوت")),
                    ),
                ),
        );
    },
};

export default profileSettingsLangHandler;
