import {
    ActionRowBuilder,
    ActivityType,
    AttachmentBuilder,
    ButtonBuilder,
    ButtonStyle,
    Client,
    GatewayIntentBits,
    MessageFlags,
    PermissionFlagsBits,
    type ButtonInteraction,
    type Guild,
    type Interaction,
    type Message,
} from "discord.js";
import { Logger } from "@logger";
import { CompetitionBot, CompetitionEntry, CompetitionVote, lowestFreeNumber, voteCount, voteCounts, type ICompetitionBot, type ICompetitionEntry } from "./models";
import { COUNT_ID, UNVOTE_ID, VOTE_ID, buildEntryPost, lineAttachment, postUrl } from "./entry-post";
import { LEADERBOARD_REFRESH_MS, buildLeaderboard } from "./leaderboard";
import { checkEntry, leaderboardRows } from "./stats";
import { SOURCE_EMOJIS, ensureApplicationEmojis, type CompetitionEmojis } from "./emojis";
import { matchesTarget, parseDmTarget, renderDm } from "./dm-template";

const PREFIX = "!";
export const COMPETITION_COMMANDS = new Set(["set-room", "register", "dm", "start", "end", "check", "leaderboard", "remove", "delete", "reset", "hide", "help"]);
const DM_WAIT_MS = 5 * 60_000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * TEMP — one competition bot: its own Discord client, locked to the server it was created in.
 * Prefix commands only (`!`), for members with Manage Server. Everything it knows is in MongoDB, so
 * a restart (or a reconnect) loses nothing and old buttons keep working.
 */
export class CompetitionBotInstance {
    readonly client: Client;
    private readonly ctx: string;
    private ticker: ReturnType<typeof setInterval> | null = null;
    private destroyed = false;
    /** Admins with a `!dm` waiting for its message — a second `!dm` from them is refused meanwhile. */
    private readonly pendingDm = new Set<string>();
    private refreshing = false;
    private postingLeaderboard = false;
    /** The bot's own copies of the emojis once uploaded (see ./emojis.ts). */
    private emojis: CompetitionEmojis = { ...SOURCE_EMOJIS };

    constructor(readonly guildId: string, private readonly token: string) {
        this.ctx = `competition:${guildId}`;
        this.client = new Client({
            intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
        });

        this.client.on("clientReady", () => this.onReady().catch(e => this.warn("ready", e)));
        this.client.on("guildCreate", guild => this.enforceGuild(guild));
        this.client.on("messageCreate", message => this.onMessage(message).catch(e => this.warn("message", e)));
        this.client.on("interactionCreate", i => this.onInteraction(i).catch(e => this.warn("interaction", e)));
        this.client.on("error", e => this.warn("client", e));
        this.client.on("shardError", e => this.warn("shard", e));
    }

    get online(): boolean {
        return this.client.isReady();
    }

    get inGuild(): boolean {
        return this.client.guilds.cache.has(this.guildId);
    }

    async start(): Promise<void> {
        await this.client.login(this.token);
    }

    async destroy(): Promise<void> {
        this.destroyed = true;
        if (this.ticker) clearInterval(this.ticker);
        await this.client.destroy();
    }

    private warn(where: string, err: unknown): void {
        Logger.warn(`${where}: ${err instanceof Error ? err.message : err}`, this.ctx);
    }

    private async onReady(): Promise<void> {
        Logger.success(`${this.client.user?.tag} online`, this.ctx);
        this.client.user?.setPresence({ activities: [{ name: "the competition", type: ActivityType.Watching }], status: "online" });
        for (const guild of this.client.guilds.cache.values()) this.enforceGuild(guild);
        if (this.client.isReady()) {
            this.emojis = await ensureApplicationEmojis(this.client, this.ctx);
            // Posts made before the bot had its own emojis still show the old ones — redraw them.
            const state = await this.state();
            if (state) void this.editAllPosts(state).catch(e => this.warn("redraw posts", e));
        }

        if (this.ticker) clearInterval(this.ticker);
        this.ticker = setInterval(() => this.tick().catch(e => this.warn("leaderboard", e)), 60_000);
        await this.tick();
    }

    /** It only ever works in its own server. */
    private enforceGuild(guild: Guild): void {
        if (guild.id === this.guildId) return;
        Logger.warn(`Added to ${guild.name} (${guild.id}) — leaving, it belongs to ${this.guildId}`, this.ctx);
        void guild.leave().catch(() => null);
    }

    private state(): Promise<ICompetitionBot | null> {
        return CompetitionBot.findOne({ guildId: this.guildId });
    }

    // ── leaderboard ──────────────────────────────────────────────────────────

    private async tick(): Promise<void> {
        const state = await this.state();
        const refreshedAt = state?.leaderboard.refreshedAt?.getTime() ?? 0;
        if (state?.leaderboard.messageId && Date.now() - refreshedAt >= LEADERBOARD_REFRESH_MS) await this.refreshLeaderboard();
    }

    private async leaderboardPayload() {
        const entries = await CompetitionEntry.find({ guildId: this.guildId, removed: false }).lean();
        const rows = await leaderboardRows(this.guildId, entries);
        const line = lineAttachment();
        const now = new Date();
        return { now, line, container: buildLeaderboard(rows, now, this.emojis, line !== null) };
    }

    /** Edits the stored leaderboard message. A deleted message is forgotten. */
    async refreshLeaderboard(): Promise<void> {
        if (this.refreshing || this.destroyed) return;
        this.refreshing = true;
        try {
            const state = await this.state();
            const { channelId, messageId } = state?.leaderboard ?? {};
            if (!channelId || !messageId) return;

            const channel = await this.client.channels.fetch(channelId).catch(() => null);
            const message = channel?.isTextBased() ? await channel.messages.fetch(messageId).catch(() => null) : null;
            if (!message) {
                await CompetitionBot.updateOne({ guildId: this.guildId }, { $set: { "leaderboard.messageId": null } });
                return;
            }
            const { now, container } = await this.leaderboardPayload();
            await message.edit({ components: [container], allowedMentions: { parse: [] } });
            await CompetitionBot.updateOne({ guildId: this.guildId }, { $set: { "leaderboard.refreshedAt": now } });
        } finally {
            this.refreshing = false;
        }
    }

    // ── posts ────────────────────────────────────────────────────────────────

    private async editPost(entry: ICompetitionEntry, state: ICompetitionBot, votes?: number): Promise<boolean> {
        const channel = await this.client.channels.fetch(entry.channelId).catch(() => null);
        const message = channel?.isTextBased() ? await channel.messages.fetch(entry.messageId).catch(() => null) : null;
        if (!message) return false;
        const hasLine = message.attachments.some(a => a.name === "line.png");
        const components = buildEntryPost(entry, state, votes ?? await voteCount(this.guildId, entry.number), this.emojis, hasLine);
        return message.edit({ components, allowedMentions: { parse: [] } }).then(() => true, () => false);
    }

    /** Re-renders every post (after `!start`, `!end`, `!hide`). */
    private async editAllPosts(state: ICompetitionBot): Promise<{ ok: number; failed: number }> {
        const [entries, counts] = await Promise.all([
            CompetitionEntry.find({ guildId: this.guildId }).sort({ number: 1 }),
            voteCounts(this.guildId),
        ]);
        let ok = 0, failed = 0;
        for (const entry of entries) {
            if (await this.editPost(entry, state, counts.get(entry.number) ?? 0)) ok++;
            else failed++;
        }
        return { ok, failed };
    }

    // ── commands ─────────────────────────────────────────────────────────────

    private async onMessage(message: Message): Promise<void> {
        if (message.author.bot || !message.inGuild() || message.guildId !== this.guildId) return;
        if (!message.content.startsWith(PREFIX)) return;

        const [rawName = "", ...rest] = message.content.slice(PREFIX.length).trim().split(/\s+/);
        const name = rawName.toLowerCase();
        if (!COMPETITION_COMMANDS.has(name)) return;
        if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) return;

        const args = rest.join(" ");
        const reply = (content: string) => message.reply({ content, allowedMentions: { parse: [] } }).catch(() => null);

        switch (name) {
            case "set-room": return this.setRoom(message, args, reply);
            case "register": return this.register(message, rest, reply);
            case "dm": return this.dm(message, args, reply);
            case "start": return this.setVoting(true, reply);
            case "end": return this.setVoting(false, reply);
            case "hide": return this.toggleHide(reply);
            case "check": return this.check(args, reply);
            case "remove": return this.remove(args, reply);
            case "delete": return this.deleteEntry(args, reply);
            case "reset": return this.reset(message, reply);
            case "leaderboard": return this.postLeaderboard(message);
            case "help": return void await reply([
                "**Competition commands**",
                "`!set-room #channel` — where participant posts are sent",
                "`!register <userID> [image]` — add a participant (attach the image)",
                "`!start` — open voting (adds the buttons)",
                "`!end` — end the competition (removes every button)",
                "`!reset` — wipe the whole competition: every post, vote and the leaderboard (asks to confirm)",
                "`!hide` — hide / show the vote-count button",
                "`!check #N` — invites and votes of participant N",
                "`!remove #N` — strike a participant out (post and number stay)",
                "`!delete #N` — delete a participant completely: post, votes and number (the next `!register` reuses it)",
                "`!leaderboard` — post the top 10 (refreshes every 5 minutes)",
                "`!dm` · `!dm #N` · `!dm >N` · `!dm <N` · `!dm =N` — DM participants",
                "Variables: `[user]` `[post]` `[vote]` `[number]` `[number;letter]` `[Label;https://link]`",
            ].join("\n"));
        }
    }

    private async setRoom(message: Message<true>, arg: string, reply: (c: string) => Promise<unknown>): Promise<void> {
        const id = arg.trim().replace(/[<#>]/g, "") || message.channelId;
        const channel = await this.client.channels.fetch(id).catch(() => null);
        if (!channel || !("guildId" in channel) || channel.guildId !== this.guildId || !channel.isSendable()) {
            return void await reply("Usage: `!set-room #channel` — a text channel of this server I can send in.");
        }
        await CompetitionBot.updateOne({ guildId: this.guildId }, { $set: { roomChannelId: channel.id } });
        await reply(`Participant posts will be sent in <#${channel.id}>.`);
    }

    private async register(message: Message<true>, args: string[], reply: (c: string) => Promise<unknown>): Promise<void> {
        const userId = args[0]?.replace(/[<@!>]/g, "");
        const image = message.attachments.find(a => a.contentType?.startsWith("image/"));
        if (!userId || !/^\d{17,20}$/.test(userId) || !image) {
            return void await reply("Usage: `!register <userID>` with the image attached.");
        }
        if (image.size > MAX_IMAGE_BYTES) return void await reply("That image is too big (10 MB max).");

        const roomId = (await this.state())?.roomChannelId;
        const room = roomId ? await this.client.channels.fetch(roomId).catch(() => null) : message.channel;
        if (!room?.isSendable()) return void await reply("I can't send in the room — set it again with `!set-room #channel`.");

        const member = await message.guild.members.fetch(userId).catch(() => null);
        if (!member) return void await reply("That user isn't in this server.");
        if (await CompetitionEntry.exists({ guildId: this.guildId, userId, removed: false })) {
            return void await reply(`<@${userId}> is already registered.`);
        }

        const data = await fetch(image.url).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null);
        if (!data) return void await reply("I couldn't download the image — try again.");

        const state = await this.state();
        if (!state) return;
        const ext = (image.name.split(".").pop() ?? "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";

        // Reserve the lowest free number; the unique index settles two registrations racing for it.
        let entry: ICompetitionEntry | null = null;
        for (let attempt = 0; attempt < 5 && !entry; attempt++) {
            const number = await lowestFreeNumber(this.guildId);
            entry = await CompetitionEntry.create({ guildId: this.guildId, number, userId, channelId: room.id, imageName: `entry-${number}.${ext}` })
                .catch(err => { if ((err as { code?: number }).code === 11000) return null; throw err; });
        }
        if (!entry) return void await reply("Couldn't reserve a number — try again.");
        const { number, imageName } = entry;

        const line = lineAttachment();
        const post = await room.send({
            components: buildEntryPost(entry, state, 0, this.emojis, line !== null),
            files: [new AttachmentBuilder(Buffer.from(data), { name: imageName }), ...(line ? [line] : [])],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { parse: [] },
        }).catch(e => { this.warn("register", e); return null; });
        if (!post) {
            await entry.deleteOne();
            return void await reply("I couldn't post it — I need Send Messages, Attach Files and Embed Links in the room.");
        }

        entry.channelId = post.channelId;
        entry.messageId = post.id;
        await entry.save();
        if (post.channelId === message.channelId) await message.delete().catch(() => null);
        else await reply(`✅ #${number} <@${userId}> posted in <#${post.channelId}>.`);
    }

    private async setVoting(open: boolean, reply: (c: string) => Promise<unknown>): Promise<void> {
        const state = await CompetitionBot.findOneAndUpdate(
            { guildId: this.guildId },
            { $set: open ? { started: true, ended: false } : { started: false, ended: true } },
            { new: true },
        );
        if (!state) return;
        await reply(open ? "Voting is open — adding the buttons…" : "Ending the competition — removing every button…");
        const { ok, failed } = await this.editAllPosts(state);
        await this.refreshLeaderboard().catch(e => this.warn("leaderboard", e));
        await reply(`${open ? "✅ Voting is open." : "🏁 The competition has ended."} ${ok} post(s) updated${failed ? `, ${failed} couldn't be (deleted?)` : ""}.`);
    }

    private async toggleHide(reply: (c: string) => Promise<unknown>): Promise<void> {
        const current = await this.state();
        if (!current) return;
        const state = await CompetitionBot.findOneAndUpdate({ guildId: this.guildId }, { $set: { hideCounts: !current.hideCounts } }, { new: true });
        if (!state) return;
        const { ok } = await this.editAllPosts(state);
        await reply(`${state.hideCounts ? "Vote counts are hidden" : "Vote counts are shown again"} (${ok} post(s) updated).${state.started ? "" : " Buttons appear once you use `!start`."}`);
    }

    private async findEntry(arg: string): Promise<ICompetitionEntry | null> {
        const n = /^#?(\d+)$/.exec(arg.trim());
        return n ? CompetitionEntry.findOne({ guildId: this.guildId, number: Number(n[1]) }) : null;
    }

    private async check(arg: string, reply: (c: string) => Promise<unknown>): Promise<void> {
        const entry = await this.findEntry(arg);
        if (!entry) return void await reply("Usage: `!check #N` — no participant with that number.");
        const c = await checkEntry(entry);
        await reply([
            `${this.emojis.minidot} **#${entry.number}** <@${entry.userId}>${entry.removed ? " (removed)" : ""}`,
            `${this.emojis.info} Invites: **${c.invites}**`,
            `${this.emojis.info} Fake invites: **${c.fakes}**`,
            `${this.emojis.info} Votes from people they invited: **${c.fromInvited}**`,
            `${this.emojis.info} Votes from people they didn't invite: **${c.fromOthers}**`,
            `${this.emojis.info} Total votes: **${c.total}**`,
            `${this.emojis.info} Votes without fakes and without who left: **${c.real}**`,
        ].join("\n"));
    }

    private async remove(arg: string, reply: (c: string) => Promise<unknown>): Promise<void> {
        const entry = await this.findEntry(arg);
        if (!entry) return void await reply("Usage: `!remove #N` — no participant with that number.");
        if (entry.removed) return void await reply(`#${entry.number} is already removed.`);

        entry.removed = true;
        await entry.save();
        // Their voters get their vote back, to give to someone else.
        await CompetitionVote.deleteMany({ guildId: this.guildId, number: entry.number });
        const state = await this.state();
        const edited = state ? await this.editPost(entry, state, 0) : false;
        await reply(`#${entry.number} <@${entry.userId}> was removed${edited ? "" : " (I couldn't edit the post — was it deleted?)"}.`);
    }

    private async deleteEntry(arg: string, reply: (c: string) => Promise<unknown>): Promise<void> {
        const entry = await this.findEntry(arg);
        if (!entry) return void await reply("Usage: `!delete #N` — no participant with that number.");

        const channel = entry.messageId ? await this.client.channels.fetch(entry.channelId).catch(() => null) : null;
        const postGone = !entry.messageId || (channel?.isTextBased()
            ? await channel.messages.delete(entry.messageId).then(() => true, (e: { code?: number }) => e.code === 10008)
            : true);
        if (entry.lineMessageId && channel?.isTextBased()) await channel.messages.delete(entry.lineMessageId).catch(() => null);

        // Their voters get their vote back; the number is free for the next `!register`.
        await CompetitionVote.deleteMany({ guildId: this.guildId, number: entry.number });
        await entry.deleteOne();
        await reply(`#${entry.number} <@${entry.userId}> was deleted${postGone ? "" : " (I couldn't delete the post — delete it by hand)"}. The next \`!register\` gets #${await lowestFreeNumber(this.guildId)}.`);
    }

    /** Back to a fresh competition: every post and the leaderboard deleted, entries and votes gone. Room and token stay. */
    private async reset(message: Message<true>, reply: (c: string) => Promise<unknown>): Promise<void> {
        if (!message.channel.isTextBased()) return;
        await reply("⚠️ This deletes **every** participant post, all votes and the leaderboard. Type `confirm` within 30 seconds.");
        const answer = await message.channel.awaitMessages({ filter: m => m.author.id === message.author.id, max: 1, time: 30_000 }).catch(() => null);
        if (answer?.first()?.content.trim().toLowerCase() !== "confirm") return void await reply("Reset cancelled.");

        await reply("Resetting…");
        const [entries, state] = await Promise.all([CompetitionEntry.find({ guildId: this.guildId }), this.state()]);
        const messages = entries.flatMap(e => [e.messageId, e.lineMessageId].filter(Boolean).map(messageId => ({ channelId: e.channelId, messageId })));
        if (state?.leaderboard.channelId && state.leaderboard.messageId) {
            messages.push({ channelId: state.leaderboard.channelId, messageId: state.leaderboard.messageId });
        }

        let failed = 0;
        for (const { channelId, messageId } of messages) {
            const channel = await this.client.channels.fetch(channelId).catch(() => null);
            const ok = channel?.isTextBased()
                ? await channel.messages.delete(messageId).then(() => true, (e: { code?: number }) => e.code === 10008)
                : true;
            if (!ok) failed++;
        }

        await Promise.all([
            CompetitionEntry.deleteMany({ guildId: this.guildId }),
            CompetitionVote.deleteMany({ guildId: this.guildId }),
            CompetitionBot.updateOne({ guildId: this.guildId }, {
                $set: { started: false, ended: false, hideCounts: false, leaderboard: { channelId: null, messageId: null, refreshedAt: null } },
            }),
        ]);
        await reply(`♻️ The competition was reset: ${messages.length - failed} message(s) deleted${failed ? `, ${failed} couldn't be (delete them by hand)` : ""}. The next \`!register\` is #1.`);
    }

    /**
     * Only one leaderboard exists: the command message is deleted, then the old leaderboard, then
     * the new one is sent where the command was used.
     */
    private async postLeaderboard(message: Message<true>): Promise<void> {
        if (!message.channel.isSendable() || this.postingLeaderboard) return;
        this.postingLeaderboard = true;
        try {
            await message.delete().catch(() => null);
            const state = await this.state();
            if (!state) return;

            const old = state.leaderboard;
            if (old.channelId && old.messageId) {
                const oldChannel = await this.client.channels.fetch(old.channelId).catch(() => null);
                if (oldChannel?.isTextBased()) await oldChannel.messages.delete(old.messageId).catch(() => null);
                await CompetitionBot.updateOne({ guildId: this.guildId }, { $set: { "leaderboard.messageId": null } });
            }

            const { now, line, container } = await this.leaderboardPayload();
            const sent = await message.channel.send({
                components: [container],
                files: line ? [line] : [],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { parse: [] },
            }).catch(e => { this.warn("leaderboard", e); return null; });
            if (!sent) return;
            await CompetitionBot.updateOne({ guildId: this.guildId }, { $set: { leaderboard: { channelId: sent.channelId, messageId: sent.id, refreshedAt: now } } });
        } finally {
            this.postingLeaderboard = false;
        }
    }

    private async dm(message: Message<true>, arg: string, reply: (c: string) => Promise<unknown>): Promise<void> {
        const target = parseDmTarget(arg);
        if (!target) return void await reply("Usage: `!dm`, `!dm #N`, `!dm >N`, `!dm <N` or `!dm =N`.");
        if (this.pendingDm.has(message.author.id)) return void await reply("I'm already waiting for your message.");
        if (!message.channel.isTextBased()) return;

        this.pendingDm.add(message.author.id);
        let text: string | null = null;
        try {
            await reply("Send your message now (5 minutes, `cancel` to stop).\nVariables: `[user]` `[post]` `[vote]` `[number]` `[number;letter]` `[Label;https://link]`");
            const collected = await message.channel.awaitMessages({ filter: m => m.author.id === message.author.id, max: 1, time: DM_WAIT_MS }).catch(() => null);
            text = collected?.first()?.content ?? null;
        } finally {
            this.pendingDm.delete(message.author.id);
        }
        if (!text) return void await reply("No message — nothing was sent.");
        if (text.trim().toLowerCase() === "cancel") return void await reply("Cancelled.");

        const [entries, counts] = await Promise.all([
            CompetitionEntry.find({ guildId: this.guildId, removed: false }).sort({ number: 1 }),
            voteCounts(this.guildId),
        ]);
        const targets = entries.filter(e => matchesTarget(target, e, counts.get(e.number) ?? 0));
        if (!targets.length) return void await reply("No participant matches that.");

        await reply(`Sending to ${targets.length} participant(s)…`);
        let sent = 0;
        const failed: number[] = [];
        for (const entry of targets) {
            const { content, buttons } = renderDm(text, { userId: entry.userId, post: postUrl(entry), votes: counts.get(entry.number) ?? 0, number: entry.number });
            const user = await this.client.users.fetch(entry.userId).catch(() => null);
            const ok = user && content
                ? await user.send({ content, components: buttons }).then(() => true, () => false)
                : false;
            if (ok) sent++;
            else failed.push(entry.number);
            await sleep(1_000);
        }
        await reply(`✅ Sent to ${sent}/${targets.length}.${failed.length ? ` Failed (DMs closed?): ${failed.map(n => `#${n}`).join(", ")}` : ""}`);
    }

    // ── buttons ──────────────────────────────────────────────────────────────

    private async onInteraction(interaction: Interaction): Promise<void> {
        if (!interaction.isButton() || interaction.guildId !== this.guildId) return;
        const id = interaction.customId;
        if (id.startsWith(VOTE_ID)) return this.vote(interaction, Number(id.slice(VOTE_ID.length)));
        if (id.startsWith(UNVOTE_ID)) return this.unvote(interaction, Number(id.slice(UNVOTE_ID.length)));
        if (id.startsWith(COUNT_ID)) {
            const n = Number(id.slice(COUNT_ID.length));
            await interaction.reply({ content: `#${n} has **${await voteCount(this.guildId, n)}** vote(s).`, flags: MessageFlags.Ephemeral });
        }
    }

    /**
     * One vote per member in the whole competition. Pressing the vote button of the participant you
     * already voted for asks whether to remove that vote (a red button) — it is never removed by accident.
     */
    private async vote(interaction: ButtonInteraction, number: number): Promise<void> {
        const ephemeral = (content: string, components: ActionRowBuilder<ButtonBuilder>[] = []) =>
            interaction.reply({ content, components, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
        const [state, entry] = await Promise.all([this.state(), CompetitionEntry.findOne({ guildId: this.guildId, number })]);
        if (!state?.started || state.ended) return void await ephemeral("التصويت غير متاح حاليا.");
        if (!entry || entry.removed) return void await ephemeral("هذا المتسابق لم يعد في المسابقة.");
        if (entry.userId === interaction.user.id) return void await ephemeral("لا يمكنك التصويت لنفسك.");

        const existing = await CompetitionVote.findOne({ guildId: this.guildId, voterId: interaction.user.id });
        if (existing && existing.number === number) {
            return void await ephemeral("لقد قمت بالتصويت على هذا المتسابق مسبقا هل تريد ازالة تصويت ؟", [
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder().setCustomId(`${UNVOTE_ID}${number}`).setStyle(ButtonStyle.Danger).setLabel("ازالة التصويت"),
                ),
            ]);
        }
        if (existing) return void await ephemeral(`لقد قمت بالتصويت مسبقا على المتسابق **#${existing.number}**. يمكنك التصويت لمتسابق واحد فقط.`);

        const created = await CompetitionVote.create({ guildId: this.guildId, voterId: interaction.user.id, number }).then(() => true, err => {
            if ((err as { code?: number }).code === 11000) return false;
            throw err;
        });
        if (!created) return void await ephemeral("لقد قمت بالتصويت مسبقا.");

        const hasLine = interaction.message.attachments.some(a => a.name === "line.png");
        await interaction.update({ components: buildEntryPost(entry, state, await voteCount(this.guildId, number), this.emojis, hasLine), allowedMentions: { parse: [] } });
        await interaction.followUp({ content: `✅ تم التصويت للمتسابق **#${number}** <@${entry.userId}>`, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } }).catch(() => null);
    }

    /** The red button under "do you want to remove your vote?". */
    private async unvote(interaction: ButtonInteraction, number: number): Promise<void> {
        const removed = await CompetitionVote.findOneAndDelete({ guildId: this.guildId, voterId: interaction.user.id, number });
        await interaction.update({ content: removed ? `تم ازالة تصويتك للمتسابق **#${number}**.` : "لا يوجد لديك تصويت لهذا المتسابق.", components: [] });
        if (!removed) return;

        const [state, entry] = await Promise.all([this.state(), CompetitionEntry.findOne({ guildId: this.guildId, number })]);
        if (state && entry) await this.editPost(entry, state).catch(e => this.warn("unvote", e));
    }
}
