import {
    type ModalSubmitInteraction,
    EmbedBuilder,
    MessageFlags,
} from "discord.js";
import type { BotClient } from "@core/BotClient";
import type { ComponentHandler } from "@core/config";
import { Colors } from "@core/config";
import { ServerConfigRepository } from "@database/repositories";
import type { IServerRoles } from "@database/models/ServerConfig";

const ROLE_LABELS: Record<string, string> = {
    en: "English Role",
    ar: "Arabic Role",
    members: "Members Role",
    bots: "Bots Role",
};

const setRoleModalHandler: ComponentHandler<ModalSubmitInteraction> = {
    customId: /^set_role_modal_(en|ar|members|bots)$/,

    async run(interaction: ModalSubmitInteraction, client: BotClient) {
        const type = interaction.customId.replace("set_role_modal_", "") as keyof IServerRoles;
        const label = ROLE_LABELS[type] ?? type;
        const guildId = interaction.guildId!;

        const roleId = interaction.fields.getTextInputValue("role_id").trim();

        const guild = client.guilds.cache.get(guildId);
        const role = guild?.roles.cache.get(roleId);
        if (!role) {
            await interaction.reply({
                embeds: [new EmbedBuilder().setDescription(`❌ Role \`${roleId}\` not found in this server.`).setColor(Colors.error)],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        await ServerConfigRepository.setRole(guildId, type, roleId);

        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle("✅ Role Configured")
                    .setColor(Colors.success)
                    .addFields(
                        { name: "Type", value: label, inline: true },
                        { name: "Role", value: `<@&${roleId}>`, inline: true },
                    )
                    .setTimestamp()
            ],
            flags: MessageFlags.Ephemeral,
        });
    },
};

export default setRoleModalHandler;
