import { ContainerBuilder } from "discord.js";
import type { ICommunityChallenge, ICommunityContribution } from "@database/models";
import { COLORS, QUEST_COMMUNITY_MESSAGES } from "@constants";

const BAR_WIDTH = 20;

function progressBar(fraction: number): string {
    const filled = Math.max(0, Math.min(BAR_WIDTH, Math.round(fraction * BAR_WIDTH)));
    return `${"█".repeat(filled)}${"░".repeat(BAR_WIDTH - filled)}`;
}

interface RenderInput {
    challenge: ICommunityChallenge;
    /** Buffered contribution not yet written, so the bar shows the live number. */
    pending?: number;
    /** Populated only once the week is over. */
    top?: ICommunityContribution[];
    /** This member's own share — `/quest community` adds it on top of the shared panel. */
    yours?: { field: string; value: string };
    /** How many distinct members have contributed — `/quest community` only. */
    contributorCount?: number;
}

/**
 * The single container edited all week, as a Components V2 layout.
 *
 * The remaining time uses Discord's relative timestamp, which the client renders itself — so the
 * countdown stays correct without the bot ever editing the message for it. That removes the only
 * reason this would need a heartbeat edit, and it is the largest saving available on a message
 * that lives for seven days.
 */
export function buildCommunityContainer({ challenge, pending = 0, top, yours, contributorCount }: RenderInput): ContainerBuilder {
    const text = QUEST_COMMUNITY_MESSAGES;

    const total = challenge.total + pending;
    const fraction = challenge.target > 0 ? total / challenge.target : 0;
    const percent = Math.min(100, Math.round(fraction * 100));
    const done = total >= challenge.target;
    const over = challenge.status !== "active";

    const container = new ContainerBuilder()
        .setAccentColor(done ? COLORS.success : over ? COLORS.error : COLORS.activity)
        .addTextDisplayComponents(td => td.setContent(`# ${text.title}`))
        .addTextDisplayComponents(td =>
            td.setContent(challenge.missions.map(mission => text.mission(mission.label)).join("\n"))
        )
        .addSeparatorComponents(separator => separator)
        .addTextDisplayComponents(td =>
            td.setContent(
                `**${text.progressField(percent)}**\n${text.progressValue(progressBar(fraction), total, challenge.target)}`
            )
        )
        .addTextDisplayComponents(td =>
            td.setContent(`**${text.rewardField}**  ${text.rewardValue(challenge.rewardBase)}`)
        );

    if (!over) {
        container.addTextDisplayComponents(td =>
            td.setContent(`**${text.timeLeftField}**  ${text.timeLeftValue(challenge.endsAt)}`)
        );
    }

    if (top?.length) {
        container.addTextDisplayComponents(td =>
            td.setContent(
                `**${text.topField}**\n` +
                top.map((row, index) => text.topRow(text.medals[index] ?? text.fallbackMedal(index), row.discordId, row.amount)).join("\n")
            )
        );
    }

    if (yours) {
        container.addTextDisplayComponents(td => td.setContent(`**${yours.field}**  ${yours.value}`));
    }

    if (contributorCount !== undefined) {
        container.addTextDisplayComponents(td => td.setContent(`**${text.contributorsField}**  ${contributorCount.toLocaleString()}`));
    }

    container.addTextDisplayComponents(td =>
        td.setContent(
            `-# ${over ? (done ? text.footerCompleted(challenge.contributorCount || top?.length || 0) : text.footerMissed) : text.footerRunning}`
        )
    );

    return container;
}
