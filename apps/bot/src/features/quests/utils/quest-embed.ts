import { ContainerBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import type { IQuest } from "@database/models";
import { COLORS, QUEST_MESSAGES, type QuestTier } from "@constants";

const TIER_COLOR: Record<QuestTier, number> = {
    easy: COLORS.success,
    normal: COLORS.info,
    hard: 0x8b5cf6,
    golden: 0xf5c518,
    vip: 0x9b8cff,
    special: 0xff5f9e,
};

const SLOT_BAR_WIDTH = 10;

export const claimButtonId = (questId: string): string => `quest:claim:${questId}`;

/** `▰▰▰▱▱▱▱▱▱▱` — how full the quest is, so scarcity is visible at a glance rather than as a number. */
function slotBar(taken: number, total: number): string {
    if (total <= 0) return "";
    const filled = Math.max(0, Math.min(SLOT_BAR_WIDTH, Math.round((taken / total) * SLOT_BAR_WIDTH)));
    return `${"▰".repeat(filled)}${"▱".repeat(SLOT_BAR_WIDTH - filled)}`;
}

/**
 * How many places are left, in the words a member reads first.
 *
 * The remaining count leads, because that is the number that decides whether to click. The bar and
 * the total follow it.
 */
function slotsValue(quest: IQuest): string {
    const card = QUEST_MESSAGES.card;
    if (quest.slotsTotal === null) return card.placesUnlimited;

    const left = Math.max(0, quest.slotsRemaining);
    if (left === 0) return card.placesFull(quest.slotsTotal);

    return card.placesLeft(left, quest.slotsTotal, slotBar(quest.slotsTaken, quest.slotsTotal));
}

/**
 * The claim button, on its own so the wiring test can inspect a single component rather than
 * reaching into an action row.
 */
export function buildClaimButton(quest: IQuest): ButtonBuilder {
    const button = QUEST_MESSAGES.button;

    const closed = quest.status !== "open"
        || quest.endsAt.getTime() <= Date.now()
        || quest.slotsRemaining <= 0;

    const label = closed
        ? quest.slotsRemaining <= 0 && quest.status === "open" ? button.full : button.closed
        : quest.slotsTotal === null
            ? button.claim
            : button.claimWithSlots(quest.slotsRemaining);

    return new ButtonBuilder()
        .setCustomId(claimButtonId(String(quest._id)))
        .setLabel(label)
        .setEmoji(closed ? button.closedEmoji : button.openEmoji)
        .setStyle(closed ? ButtonStyle.Secondary : ButtonStyle.Success)
        .setDisabled(closed);
}

/**
 * The posted quest card, as a Components V2 container.
 *
 * Objectives are numbered lines in their own text display rather than embed fields: fields wrap
 * into columns at unpredictable widths, and a four-objective Hard quest ends up reading as a grid
 * of fragments. The claim button sits inside the container's own action row, so the card and the
 * button that changes it are always one message, edited together.
 */
export function buildQuestContainer(quest: IQuest): ContainerBuilder {
    const card = QUEST_MESSAGES.card;
    const tier = quest.tier as QuestTier;
    const closed = quest.status !== "open" || quest.endsAt.getTime() <= Date.now();

    const objectives = quest.missions
        .map((mission, index) => card.objective(index, mission.label))
        .join("\n");

    const container = new ContainerBuilder()
        .setAccentColor(TIER_COLOR[tier])
        .addTextDisplayComponents(text =>
            text.setContent(`${card.author(tier)}\n# ${card.title(tier)}`)
        )
        .addTextDisplayComponents(text =>
            text.setContent(objectives || card.noObjectives)
        )
        .addSeparatorComponents(separator => separator)
        .addTextDisplayComponents(text =>
            text.setContent(
                `**${card.rewardField}**  ${card.rewardValue(quest.reward)}\n` +
                `**${card.placesField}**  ${slotsValue(quest)}\n` +
                `**${card.endsField(closed)}**  ${card.endsValue(quest.endsAt)}`
            )
        )
        .addActionRowComponents(row => row.addComponents(buildClaimButton(quest)))
        .addTextDisplayComponents(text =>
            text.setContent(`-# ${card.footer(card.objectiveCount(quest.missions.length), tier)}`)
        );

    return container;
}
