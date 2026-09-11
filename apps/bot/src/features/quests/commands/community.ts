import { ContainerBuilder, MessageFlags } from "discord.js";
import type { FeatureSubcommandHandler } from "@typings/feature";
import { COLORS, QUEST_COMMUNITY_MESSAGES } from "@constants";
import { CommunityChallengeRepository, QuestSettingsRepository } from "@database/repositories";
import { pendingTotal } from "@core/quests";
import { buildCommunityContainer } from "../utils/community-embed";

/**
 * A snapshot of the week's challenge, with this member's own share.
 *
 * The same renderer as the live panel, so the two can never drift apart — this adds the personal
 * fields the shared container has no business carrying.
 */
export const community: FeatureSubcommandHandler = async (interaction, _client) => {
    const text = QUEST_COMMUNITY_MESSAGES;
    const guildId = interaction.guildId!;
    const challenge = await CommunityChallengeRepository.findActive(guildId);

    if (!challenge) {
        const settings = await QuestSettingsRepository.getCached(guildId);

        await interaction.editReply({
            components: [
                new ContainerBuilder()
                    .setAccentColor(COLORS.info)
                    .addTextDisplayComponents(td => td.setContent(`# ${text.title}`))
                    .addTextDisplayComponents(td =>
                        td.setContent(settings.communityEnabled ? text.noneRunning : text.disabled)
                    ),
            ],
            flags: MessageFlags.IsComponentsV2,
        });
        return;
    }

    const [mine, top, contributors] = await Promise.all([
        CommunityChallengeRepository.contributionFor(guildId, challenge.weekKey, interaction.user.id),
        CommunityChallengeRepository.topContributors(guildId, challenge.weekKey, 5),
        CommunityChallengeRepository.countContributors(guildId, challenge.weekKey),
    ]);

    const amount = mine?.amount ?? 0;

    const container = buildCommunityContainer({
        challenge,
        pending: pendingTotal(guildId),
        top,
        yours: {
            field: text.yourContributionField,
            value: amount >= challenge.minContribution
                ? text.yourContributionQualified(amount)
                : text.yourContributionShort(amount, challenge.minContribution - amount),
        },
        contributorCount: contributors,
    });

    // A Components V2 text display genuinely pings a mentioned member, unlike an embed field — the
    // top five's <@id> rows must not notify five people every time anyone runs this command.
    await interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
    });
};
