import type { ClientManager } from "@core/client-manager";
import type { ChatInputCommandInteraction } from "discord.js";
import { Logger } from "@logger";

import { L } from "@utils";
export async function systemReload(interaction: ChatInputCommandInteraction, manager: ClientManager) {
    await interaction.deferReply();

    try {
        await manager.reload();
        await interaction.editReply({
            content: L(`✅ Reloaded ${manager.getStatus().commands} command(s) and their components.`, `✅ تم تحديث ${manager.getStatus().commands} أمر مع مكوناتها.`),
        });
    } catch (error) {
        Logger.error(`Failed to reload modules: ${error}`, "system");
        await interaction.editReply({
            content: L("❌ Reload failed. Check logs for details.", "❌ فشل التحديث. شيك اللوقات."),
        });
    }
}
