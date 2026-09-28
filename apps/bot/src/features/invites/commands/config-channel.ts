import type { FeatureSubcommandHandler } from "@typings/feature";
import { ServerConfigRepository } from "@database/repositories";

/** Sets where joins are announced. Omitting the channel stops the announcements; tracking carries on. */
export const configChannel: FeatureSubcommandHandler = async (interaction, _client) => {
    const channel = interaction.options.getChannel("channel");
    await ServerConfigRepository.setInviteLogChannel(interaction.guildId!, channel?.id ?? null);

    await interaction.editReply({
        content: channel
            ? `Every join will now be announced in <#${channel.id}>, with who invited them.`
            : "Join announcements are off. Invites are still tracked.",
    });
};
