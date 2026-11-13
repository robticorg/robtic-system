import { ContextMenuCommandBuilder, ApplicationCommandType, UserContextMenuCommandInteraction } from "discord.js";
import { openPunishForm } from "@bot/utils/moderation/punish-flow/punish-form";

/**
 * Right-click a member → Jail User: reason and length (and proof, when the moderator needs it) in a form.
 * Same staff level as `/jail` (it was 20 here, which let junior staff jail through the menu).
 */
export default {
    scope: "guild",
    category: "Moderation",
    data: new ContextMenuCommandBuilder()
        .setName("Jail User")
        .setType(ApplicationCommandType.User),

    requiredPermission: 60,

    async run(interaction: UserContextMenuCommandInteraction) {
        await openPunishForm(interaction, "ban");
    },
};
