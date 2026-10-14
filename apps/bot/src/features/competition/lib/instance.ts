import {
    ActivityType,
    AttachmentBuilder,
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
import { CompetitionBot, CompetitionEntry, CompetitionVote, voteCount, voteCounts, type ICompetitionBot, type ICompetitionEntry } from "./models";
import { COUNT_ID, EMOJI, VOTE_ID, buildEntryPost, lineAttachment, postUrl } from "./entry-post";
import { LEADERBOARD_REFRESH_MS, buildLeaderboard } from "./leaderboard";
import { checkEntry, leaderboardRows } from "./stats";
import { matchesTarget, parseDmTarget, renderDm } from "./dm-template";

const PREFIX = "!";
export const COMPETITION_COMMANDS = new Set(["set-room", "register", "dm", "start", "end", "check", "leaderboard", "remove", "hide", "help"]);
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
        return { now, line, container: buildLeaderboard(rows, now, line !== null) };
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
        const components = buildEntryPost(entry, state, votes ?? await voteCount(this.guildId, entry.number), hasLine);
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
            case "leaderboard": return this.postLeaderboard(message, reply);
            case "help": return void await reply([
                "**Competition commands**",
                "`!set-room #channel` — where participant posts are sent",
                "`!register <userID> [image]` — add a participant (attach the image)",
                "`!start` — open voting (adds the buttons)",
                "`!end` — end the competition (removes every button)",
                "`!hide` — hide / show the vote-count button",
                "`!check #N` — invites and votes of participant N",
                "`!remove #N` — strike a participant out",
                "`!leaderboard` — post the top 10 (refreshes every hour)",
                "`!dm` · `!dm #N` · `!dm >N` · `!dm <N` · `!dm =N` — DM participants",
                "Variables: `[user]` `[post]` `[vote]` `[Label;https://link]`",
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

        const state = await CompetitionBot.findOneAndUpdate({ guildId: this.guildId }, { $inc: { nextNumber: 1 } }, { new: false });
        if (!state) return;
        const number = state.nextNumber;
        const ext = (image.name.split(".").pop() ?? "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
        const imageName = `entry-${number}.${ext}`;

        const line = lineAttachment();
        const entryLike = { number, userId, imageName, removed: false };
        const post = await room.send({
            components: buildEntryPost(entryLike, state, 0, line !== null),
            files: [new AttachmentBuilder(Buffer.from(data), { name: imageName }), ...(line ? [line] : [])],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { parse: [] },
        }).catch(e => { this.warn("register", e); return null; });
        if (!post) return void await reply("I couldn't post it — I need Send Messages, Attach Files and Embed Links in the room.");

        await CompetitionEntry.create({ guildId: this.guildId, number, userId, channelId: post.channelId, messageId: post.id, imageName });
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
            `${EMOJI.minidot} **#${entry.number}** <@${entry.userId}>${entry.removed ? " (removed)" : ""}`,
            `${EMOJI.info} Invites: **${c.invites}**`,
            `${EMOJI.info} Fake invites: **${c.fakes}**`,
            `${EMOJI.info} Votes from people they invited: **${c.fromInvited}**`,
            `${EMOJI.info} Votes from people they didn't invite: **${c.fromOthers}**`,
            `${EMOJI.info} Total votes: **${c.total}**`,
            `${EMOJI.info} Votes without fakes and without who left: **${c.real}**`,
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

    private async postLeaderboard(message: Message<true>, reply: (c: string) => Promise<unknown>): Promise<void> {
        if (!message.channel.isSendable()) return;
        const state = await this.state();
        if (!state) return;
        const { now, line, container } = await this.leaderboardPayload();
        const sent = await message.channel.send({
            components: [container],
            files: line ? [line] : [],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { parse: [] },
        }).catch(e => { this.warn("leaderboard", e); return null; });
        if (!sent) return void await reply("I couldn't post the leaderboard here.");

        const old = state.leaderboard;
        if (old.channelId && old.messageId && old.messageId !== sent.id) {
            const oldChannel = await this.client.channels.fetch(old.channelId).catch(() => null);
            if (oldChannel?.isTextBased()) await oldChannel.messages.delete(old.messageId).catch(() => null);
        }
        await CompetitionBot.updateOne({ guildId: this.guildId }, { $set: { leaderboard: { channelId: sent.channelId, messageId: sent.id, refreshedAt: now } } });
        await message.delete().catch(() => null);
    }

    private async dm(message: Message<true>, arg: string, reply: (c: string) => Promise<unknown>): Promise<void> {
        const target = parseDmTarget(arg);
        if (!target) return void await reply("Usage: `!dm`, `!dm #N`, `!dm >N`, `!dm <N` or `!dm =N`.");
        if (this.pendingDm.has(message.author.id)) return void await reply("I'm already waiting for your message.");
        if (!message.channel.isTextBased()) return;

        this.pendingDm.add(message.author.id);
        let text: string | null = null;
        try {
            await reply("Send your message now (5 minutes, `cancel` to stop).\nVariables: `[user]` `[post]` `[vote]` `[Label;https://link]`");
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
            const { content, buttons } = renderDm(text, { userId: entry.userId, post: postUrl(entry), votes: counts.get(entry.number) ?? 0 });
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
        if (interaction.customId.startsWith(VOTE_ID)) return this.vote(interaction, Number(interaction.customId.slice(VOTE_ID.length)));
        if (interaction.customId.startsWith(COUNT_ID)) {
            const n = Number(interaction.customId.slice(COUNT_ID.length));
            await interaction.reply({ content: `#${n} has **${await voteCount(this.guildId, n)}** vote(s).`, flags: MessageFlags.Ephemeral });
        }
    }

    private async vote(interaction: ButtonInteraction, number: number): Promise<void> {
        const ephemeral = (content: string) => interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
        const [state, entry] = await Promise.all([this.state(), CompetitionEntry.findOne({ guildId: this.guildId, number })]);
        if (!state?.started || state.ended) return void await ephemeral("Voting isn't open.");
        if (!entry || entry.removed) return void await ephemeral("This participant isn't in the competition anymore.");
        if (entry.userId === interaction.user.id) return void await ephemeral("You can't vote for yourself.");

        const existing = await CompetitionVote.findOne({ guildId: this.guildId, voterId: interaction.user.id });
        let note: string;
        if (existing && existing.number === number) {
            await existing.deleteOne();
            note = `Your vote for **#${number}** was removed.`;
        } else if (existing) {
            return void await ephemeral(`You already voted for **#${existing.number}**. Press its vote button again to take your vote back first.`);
        } else {
            const created = await CompetitionVote.create({ guildId: this.guildId, voterId: interaction.user.id, number }).then(() => true, err => {
                if ((err as { code?: number }).code === 11000) return false;
                throw err;
            });
            if (!created) return void await ephemeral("You already voted.");
            note = `✅ You voted for **#${number}** <@${entry.userId}>. Press again to take it back.`;
        }

        const hasLine = interaction.message.attachments.some(a => a.name === "line.png");
        await interaction.update({ components: buildEntryPost(entry, state, await voteCount(this.guildId, number), hasLine), allowedMentions: { parse: [] } });
        await interaction.followUp({ content: note, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } }).catch(() => null);
    }
}
