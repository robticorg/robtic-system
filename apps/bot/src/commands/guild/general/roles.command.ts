import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { MODERATION_ACTION_MESSAGES as MSG } from "@constants";
import { openRolesSession, renderRolesPanel } from "@bot/utils/roles-view/roles-panel";

/**
 * `roles` — every role on the server, 15 per page:
 * `N. @role | type | #order | N members`. The type and staff order come from the staff API
 * (`/internal/staff/role`); the order is shown only for staff roles. ◀ ▶ to page, 🔍 to search
 * by name or id, ⚙️ to filter (type, staff order range, minimum members, sort).
 */
export default {
    scope: "guild",
    access: "general",
    category: "Moderation",
    data: new SlashCommandBuilder()
        .setName("roles")
        .setDescription("Every role on this server: type, staff order and members — search and filter"),

    async run(interaction: ChatInputCommandInteraction) {
        const guild = interaction.guild;
        if (!guild) {
            await interaction.reply({ content: MSG.guildOnly });
            return;
        }

        await interaction.deferReply();

        const session = await openRolesSession(guild, interaction.user.id);
        if (!session.rows.length) {
            await interaction.editReply({ content: MSG.rolesListEmpty });
            return;
        }

        await interaction.editReply(renderRolesPanel(session));
    },
};
