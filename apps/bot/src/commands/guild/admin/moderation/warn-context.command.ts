import { ContextMenuCommandBuilder, ApplicationCommandType, UserContextMenuCommandInteraction } from "discord.js";
import { openPunishForm } from "@bot/utils/moderation/punish-flow/punish-form";

/** Right-click a member → Warn User: the reason (and proof, when the moderator needs it) in a form. */
export default {
    scope: "guild",
    category: "Moderation",
    data: new ContextMenuCommandBuilder()
        .setName("Warn User")
        .setType(ApplicationCommandType.User),

    requiredPermission: 20,

    async run(interaction: UserContextMenuCommandInteraction) {
        await openPunishForm(interaction, "warn");
    },
};
