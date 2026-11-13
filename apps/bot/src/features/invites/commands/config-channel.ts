import type { FeatureSubcommandHandler } from "@typings/feature";
import { ServerConfigRepository } from "@database/repositories";

import { L } from "@utils";
/** Sets where joins are announced. Omitting the channel stops the announcements; tracking carries on. */
export const configChannel: FeatureSubcommandHandler = async (interaction, _client) => {
    const channel = interaction.options.getChannel("channel");
    await ServerConfigRepository.setInviteLogChannel(interaction.guildId!, channel?.id ?? null);

    await interaction.editReply({
        content: channel
            ? L(`Every join will now be announced in <#${channel.id}>, with who invited them.`, `كل دخول بينعلن في <#${channel.id}> مع اللي دعاه.`)
            : L("Join announcements are off. Invites are still tracked.", "إعلانات الدخول مقفلة. الدعوات تنحسب عادي."),
    });
};
