import { ContainerBuilder, MessageFlags, type GuildMember, type ModalSubmitInteraction } from "discord.js";
import type { ComponentHandler } from "@typings/command";
import { hasGuildBotAdmin, isGuildOperator } from "@bot/utils/access";
import { SEND_FIELDS, SEND_MODAL_ID } from "@bot/utils/send/send-form";

/** `/send` submitted: posts the message as the bot, as plain text or as a Components V2 card. */
const sendFormHandler: ComponentHandler<ModalSubmitInteraction> = {
    customId: new RegExp(`^${SEND_MODAL_ID}$`),

    async run(interaction: ModalSubmitInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const member = interaction.member as GuildMember | null;
        if (!member || !(isGuildOperator(member) || await hasGuildBotAdmin(member))) {
            await interaction.editReply({ content: "❌ Only server admins can send messages as the bot." });
            return;
        }

        const picked = interaction.fields.getSelectedChannels(SEND_FIELDS.channel, true).first();
        const text = interaction.fields.getTextInputValue(SEND_FIELDS.message).trim();
        const asV2 = interaction.fields.getCheckbox(SEND_FIELDS.componentsV2);

        const channel = picked ? await interaction.guild?.channels.fetch(picked.id).catch(() => null) : null;
        if (!channel?.isTextBased()) {
            await interaction.editReply({ content: "❌ Channel not found." });
            return;
        }
        if (!text) {
            await interaction.editReply({ content: "❌ The message can't be empty." });
            return;
        }
        if (!asV2 && text.length > 2000) {
            await interaction.editReply({ content: `❌ Plain messages are limited to 2000 characters (yours is ${text.length}). Tick **Send as Components V2** for up to 4000.` });
            return;
        }

        try {
            await channel.send(asV2
                ? { components: [new ContainerBuilder().addTextDisplayComponents(t => t.setContent(text))], flags: MessageFlags.IsComponentsV2 }
                : { content: text });
        } catch (err) {
            await interaction.editReply({ content: `❌ I couldn't send it there: ${(err as Error).message}` });
            return;
        }

        await interaction.editReply({ content: `✅ Sent to <#${channel.id}>${asV2 ? " as Components V2" : ""}.` });
    },
};

export default sendFormHandler;
