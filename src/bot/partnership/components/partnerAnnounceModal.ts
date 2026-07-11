import { ModalSubmitInteraction, EmbedBuilder, MessageFlags } from "discord.js";
import type { BotClient } from "@core/BotClient";
import type { ComponentHandler } from "@core/config";
import { Colors } from "@core/config";
import { PartnerRepository } from "@database/repositories";
import { Logger } from "@core/libs";

const partnerAnnounceModal: ComponentHandler<ModalSubmitInteraction> = {
    customId: "partner_announce_modal",

    async run(interaction: ModalSubmitInteraction, client: BotClient) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const title = interaction.fields.getTextInputValue("announce_title").trim();
        const message = interaction.fields.getTextInputValue("announce_message").trim();

        const partners = await PartnerRepository.getAll();
        if (partners.length === 0) {
            await interaction.editReply({ content: "There are no partners in the database yet." });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle(`📢 ${title}`)
            .setDescription(message)
            .setColor(Colors.info)
            .setFooter({ text: "Robtic Partnership Announcement" })
            .setTimestamp();

        let sent = 0;
        let failed = 0;

        for (const partner of partners) {
            const user = await client.users.fetch(partner.repUserId).catch(() => null);
            if (!user) {
                failed++;
                continue;
            }
            const ok = await user
                .send({ embeds: [embed] })
                .then(() => true)
                .catch(() => false);
            if (ok) sent++;
            else failed++;
        }

        Logger.info(
            `Partner announcement sent by ${interaction.user.id}: ${sent} delivered, ${failed} failed`,
            client.botName
        );

        await interaction.editReply({
            content: `✅ Announcement sent to **${sent}** partner representative(s).${failed ? ` ⚠️ Failed to reach **${failed}**.` : ""}`,
        });
    },
};

export default partnerAnnounceModal;
