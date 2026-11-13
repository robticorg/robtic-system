import type { FeatureSubcommandHandler } from "@typings/feature";
import { StreakSettingsRepository } from "@database/repositories";

import { L } from "@utils";
/**
 * Sets where streak milestones are announced. Omitting the channel clears it, which puts the
 * announcement back in whichever channel earned the streak.
 */
export const channelAnnounce: FeatureSubcommandHandler = async (interaction, _client) => {
    const channel = interaction.options.getChannel("channel");
    await StreakSettingsRepository.setAnnounceChannel(interaction.guildId!, channel?.id ?? null);

    await interaction.editReply({
        content: channel
            ? L(`Streaks will be announced in <#${channel.id}>.`, `الستريكات بتنعلن في <#${channel.id}>.`)
            : L("No announcement channel: the bot answers in the channel where the streak happened.", "تم إلغاء روم الإعلان: البوت يرد في نفس الروم اللي صار فيه الستريك."),
    });
};
