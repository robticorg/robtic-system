import {
    type ModalSubmitInteraction,
    EmbedBuilder,
    MessageFlags,
} from "discord.js";
import type { ComponentHandler } from "@core/config";
import { Colors } from "@core/config";
import { UserRepository } from "@database/repositories";
import { getUserLang, t } from "@shared/utils/lang";
import type { GuildMember } from "discord.js";

const profileDisplayNameModalHandler: ComponentHandler<ModalSubmitInteraction> = {
    customId: /^profile_settings_name_modal_\d+$/,

    async run(interaction: ModalSubmitInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const userId = interaction.customId.replace("profile_settings_name_modal_", "");
        if (interaction.user.id !== userId) {
            await interaction.editReply({ content: "This isn't your settings panel." });
            return;
        }

        const name = interaction.fields.getTextInputValue("display_name").trim();
        const lang = await getUserLang(interaction.member as GuildMember | null);

        await UserRepository.setDisplayName(userId, interaction.user.username, name);

        await interaction.editReply({
            embeds: [new EmbedBuilder().setDescription(t("settings.name_updated", lang, { name })).setColor(Colors.success)],
        });
    },
};

export default profileDisplayNameModalHandler;
