import { existsSync, readFileSync } from "fs";
import path from "path";
import {
    ActionRowBuilder,
    AttachmentBuilder,
    ButtonBuilder,
    ButtonStyle,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    TextDisplayBuilder,
} from "discord.js";
import type { ICompetitionBot, ICompetitionEntry } from "./models";
import { buttonEmoji, type CompetitionEmojis } from "./emojis";

export const VOTE_ID = "comp:vote:";
export const COUNT_ID = "comp:count:";

export const LINE_NAME = "line.png";
const LINE_PATH = path.join(process.cwd(), "images", LINE_NAME);
let lineData: Buffer | null | undefined;

/** `images/line.png`, read once. `null` if the file is missing — posts then go out without the line. */
export function lineAttachment(): AttachmentBuilder | null {
    if (lineData === undefined) lineData = existsSync(LINE_PATH) ? readFileSync(LINE_PATH) : null;
    return lineData ? new AttachmentBuilder(lineData, { name: LINE_NAME }) : null;
}

type PostComponent = TextDisplayBuilder | MediaGalleryBuilder | SeparatorBuilder | ActionRowBuilder<ButtonBuilder>;
type CompetitionState = Pick<ICompetitionBot, "started" | "ended" | "hideCounts">;
type EntryLike = Pick<ICompetitionEntry, "number" | "userId" | "imageName" | "removed">;

/**
 * A participant's post (components v2):
 *
 *     <minidot> **#N <@user>**        (struck through once removed)
 *     [their image]
 *     ───────────
 *     [line.png]
 *     [<add>| تـصـويـت] [<info>| N]   (only while voting is open; the count goes with `!hide`)
 *
 * Images are referenced by file name, so an edit keeps pointing at the files already on the message.
 */
export function buildEntryPost(entry: EntryLike, state: CompetitionState, votes: number, emojis: CompetitionEmojis, hasLine = lineAttachment() !== null): PostComponent[] {
    const title = `**#${entry.number} <@${entry.userId}>**`;
    const components: PostComponent[] = [
        new TextDisplayBuilder().setContent(`${emojis.minidot} ${entry.removed ? `~~${title}~~` : title}`),
        new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(`attachment://${entry.imageName}`)),
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    ];
    if (hasLine) components.push(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(`attachment://${LINE_NAME}`)));

    if (state.started && !state.ended && !entry.removed) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`${VOTE_ID}${entry.number}`)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(buttonEmoji(emojis.add))
                .setLabel("| تـصـويـت"),
        );
        if (!state.hideCounts) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`${COUNT_ID}${entry.number}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(buttonEmoji(emojis.info))
                    .setLabel(`| ${votes}`),
            );
        }
        components.push(row);
    }
    return components;
}

export function postUrl(entry: Pick<ICompetitionEntry, "guildId" | "channelId" | "messageId">): string {
    return `https://discord.com/channels/${entry.guildId}/${entry.channelId}/${entry.messageId}`;
}
