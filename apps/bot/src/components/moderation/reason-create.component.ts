import { ModalSubmitInteraction, EmbedBuilder, MessageFlags } from "discord.js";
import type { ComponentHandler } from "@typings/command";
import { COLORS, PUNISH_TITLES } from "@constants";
import { ReasonRepository } from "@database/repositories";
import { L, errorText } from "@utils";

/** A key is typed in commands (`!warn @x spam`), so it's one word: letters, numbers and dashes. */
const KEY = /^[a-z0-9][a-z0-9-]{0,29}$/;

export const reasonCreateHandler: ComponentHandler<ModalSubmitInteraction> = {
    customId: /^reason_create_(warn|mute|ban)$/,

    async run(interaction: ModalSubmitInteraction) {
        if (!interaction.guildId) return;
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const type = interaction.customId.split("_")[2] as "warn" | "mute" | "ban";
        const key = interaction.fields.getTextInputValue("reason_key").toLowerCase().trim().replace(/\s+/g, "-");
        const label = interaction.fields.getTextInputValue("reason_label").trim();
        const labelAr = interaction.fields.getTextInputValue("reason_label_ar").trim();

        if (!KEY.test(key)) {
            await interaction.editReply({ content: errorText(L("The key must be one word: English letters, numbers and dashes (up to 30), like `spam` or `bad-words`.", "المفتاح لازم يكون كلمة وحدة: حروف إنجليزية وأرقام وشرطات (حتى 30)، مثل `spam` أو `bad-words`.")) });
            return;
        }
        if (!label || !labelAr) {
            await interaction.editReply({ content: errorText(L("Write the reason in both languages.", "اكتب السبب باللغتين.")) });
            return;
        }
        if (await ReasonRepository.findOwn(key, interaction.guildId)) {
            await interaction.editReply({ content: errorText(L(`There's already a reason \`${key}\`.`, `في سبب اسمه \`${key}\` من قبل.`)) });
            return;
        }

        await ReasonRepository.create({ guildId: interaction.guildId, key, label, labelAr, type, createdBy: interaction.user.id });

        await interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setTitle(L("✅ Reason added", "✅ تمت إضافة السبب"))
                    .setColor(COLORS.success)
                    .addFields(
                        { name: L("Key", "المفتاح"), value: `\`${key}\``, inline: true },
                        { name: L("Type", "النوع"), value: PUNISH_TITLES[type], inline: true },
                        { name: L("English", "الإنجليزي"), value: label },
                        { name: L("Arabic", "العربي"), value: labelAr },
                    )
                    .setTimestamp(),
            ],
        });
    },
};
