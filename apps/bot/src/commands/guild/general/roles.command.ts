import { SlashCommandBuilder, type ChatInputCommandInteraction, type GuildMember } from "discord.js";
import { MODERATION_ACTION_MESSAGES as MSG } from "@constants";
import { getUserLang, t } from "@bot/utils/lang";
import { openRolesSession, renderRolesPanel } from "@bot/utils/roles-view/roles-panel";

/**
 * `roles` — every role on the server, 10 per page, in Wolf Manager's layout: name, ID, mention,
 * members, and the staff type and level (from the staff API, `/internal/staff/role`) for staff
 * roles. < > to page, search by name or id, filter (type, staff level range, minimum members, sort).
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

        const lang = await getUserLang(interaction.member as GuildMember | null);
        const session = await openRolesSession(guild, interaction.user.id, lang);
        if (!session.rows.length) {
            await interaction.editReply({ content: t("roles.empty", lang) });
            return;
        }

        await interaction.editReply(renderRolesPanel(session));
    },
};
