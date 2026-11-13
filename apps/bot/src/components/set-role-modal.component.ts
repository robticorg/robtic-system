import {
    type ModalSubmitInteraction,
    EmbedBuilder,
    MessageFlags,
} from "discord.js";
import type { BotClient } from "@core/bot-client";
import type { ComponentHandler } from "@typings/command";
import { COLORS } from "@constants";
import { ServerConfigRepository } from "@database/repositories";
import type { IServerRoles } from "@database/models/ServerConfig";

import { L, bilingual } from "@utils";
const ROLE_LABELS = bilingual<Record<string, string>>(
    { en: "English role", ar: "Arabic role", members: "Members role", bots: "Bots role" },
    { en: "رتبة الإنجليزي", ar: "رتبة العربي", members: "رتبة الأعضاء", bots: "رتبة البوتات" },
);

const setRoleModalHandler: ComponentHandler<ModalSubmitInteraction> = {
    customId: /^set_role_modal_(en|ar|members|bots)$/,

    async run(interaction: ModalSubmitInteraction, client: BotClient) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const type = interaction.customId.replace("set_role_modal_", "") as keyof IServerRoles;
        const label = ROLE_LABELS[type] ?? type;
        const guildId = interaction.guildId!;

        const roleId = interaction.fields.getTextInputValue("role_id").trim();

        const guild = client.guilds.cache.get(guildId);
        const role = guild?.roles.cache.get(roleId);
        if (!role) {
            await interaction.editReply({
                embeds: [new EmbedBuilder().setDescription(L(`❌ Role \`${roleId}\` not found in this server.`, `❌ الرتبة \`${roleId}\` غير موجودة في السيرفر.`)).setColor(COLORS.error)],
            });
            return;
        }

        await ServerConfigRepository.setRole(guildId, type, roleId);

        await interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setTitle(L("✅ Role set", "✅ تم ضبط الرتبة"))
                    .setColor(COLORS.success)
                    .addFields(
                        { name: L("Type", "النوع"), value: label, inline: true },
                        { name: "Role", value: `<@&${roleId}>`, inline: true },
                    )
                    .setTimestamp()
            ],
        });
    },
};

export default setRoleModalHandler;
