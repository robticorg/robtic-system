import type { GuildMember, MessageComponentInteraction } from "discord.js";
import type { ComboLeaderboardPeriod } from "@constants";
import { getUserLang } from "@bot/utils/lang";
import { buildTopView, type TopScope } from "../functions/build-top-view";

/** Redraws the panel in place on another page, keeping its board and period. */
export async function renderTopPanel(
    interaction: MessageComponentInteraction,
    invokerId: string,
    scope: TopScope,
    period: ComboLeaderboardPeriod,
    page: number,
): Promise<void> {
    const guild = interaction.guild;
    if (!guild) return;

    await interaction.deferUpdate();

    const lang = await getUserLang(interaction.member as GuildMember | null);
    const { components, files, allowedMentions } = await buildTopView(guild, scope, period, lang, { id: invokerId, name: interaction.user.username }, page);

    // The chart is a new file each time; `attachments: []` drops the old one so the message doesn't collect them.
    await interaction.editReply({ components, files, attachments: [], allowedMentions });
}
