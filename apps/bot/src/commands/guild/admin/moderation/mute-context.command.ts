import { ContextMenuCommandBuilder, ApplicationCommandType, UserContextMenuCommandInteraction } from "discord.js";
import { openPunishForm } from "@bot/utils/moderation/punish-flow/punish-form";

/** Right-click a member → Mute User: reason and hours (and proof, when the moderator needs it) in a form. */
export default {
    scope: "guild",
    category: "Moderation",
    data: new ContextMenuCommandBuilder()
        .setName("Mute User")
        .setType(ApplicationCommandType.User),

    requiredPermission: 20,

    async run(interaction: UserContextMenuCommandInteraction) {
        await openPunishForm(interaction, "mute");
    },
};
