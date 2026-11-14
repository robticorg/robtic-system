import {
    ActionRowBuilder,
    ActivityType,
    ButtonBuilder,
    ButtonStyle,
    Client,
    EmbedBuilder,
    GatewayIntentBits,
    MessageFlags,
    StringSelectMenuBuilder,
    type Guild,
    type Interaction,
    type Message,
} from "discord.js";
import {
    AudioPlayerStatus,
    NoSubscriberBehavior,
    VoiceConnectionStatus,
    createAudioPlayer,
    createAudioResource,
    entersState,
    joinVoiceChannel,
    type AudioResource,
    type VoiceConnection,
} from "@discordjs/voice";
import { MUSIC_CONFIG } from "@constants";
import { Logger } from "@logger";
import type { MusicBotMode } from "@database/models";
import { MusicSettingsRepository, ServerConfigRepository } from "@database/repositories";
import { L, DEFAULT_LANG, runWithLang } from "@utils";
import { generateBanner } from "./banner";
import { formatDuration, getAudio, resolveQuery, type AudioSource, type Track } from "./youtube";

export interface MusicBotSettings {
    botId: string;
    name: string;
    guildId: string;
    /** `fixed`: lives in `voiceChannelId`. `roaming`: joins wherever it's asked to, when that channel has no fixed bot. */
    mode: MusicBotMode;
    voiceChannelId: string | null;
}

/** Who asked for a song, and where: the voice channel to play in, and the chat the now-playing card goes to. */
export interface PlayRequest {
    requestedBy: string;
    voiceChannelId: string;
    /** Usually the voice channel's own chat. */
    textChannelId: string;
}

export interface MusicBotHooks {
    /** Text commands are routed across all of a server's music bots (runtime/router), not by each bot alone. */
    onMessage: (bot: MusicBotInstance, message: Message) => Promise<void>;
}

interface PlayingTrack extends Track {
    startedAt: number | null;
    pausedAt: number | null;
    thumbFileName: string;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Discord closes with 4014 when a bot asks for a privileged intent its owner hasn't turned on. */
export function isDisallowedIntents(err: unknown): boolean {
    const e = err as { code?: unknown; message?: unknown } | null;
    return e?.code === 4014 || e?.code === "DisallowedIntents" || /disallowed intents/i.test(String(e?.message ?? ""));
}

/**
 * One music bot: its own Discord client, voice connection, queue and now-playing card.
 *
 * A **fixed** bot belongs to one voice channel: with the server's "stay" setting on it sits there 24/7, otherwise it
 * joins when music starts and leaves a little after it ends. A **roaming** bot has no channel: it joins the channel
 * someone asks for music in (when that channel has no fixed bot), and leaves when it's done. Either way it leaves any
 * server that isn't its own.
 */
export class MusicBotInstance {
    client: Client;
    /**
     * Whether it can read typed commands: Discord gives message text only with the Message Content intent, which each
     * bot's owner turns on in the Developer Portal. Without it the bot still logs in and the control panel works.
     */
    readsMessages = true;
    private readonly ctx: string;
    private readonly player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });

    private voiceConnection: VoiceConnection | null = null;
    /** The channel it should be in; reconnects go here. Null: it means to be out of voice. */
    private wantChannelId: string | null = null;
    private queue: Track[] = [];
    private current: PlayingTrack | null = null;
    private currentProcess: Pick<AudioSource, "proc" | "ffmpeg"> | null = null;
    private activeResource: AudioResource | null = null;
    private volume: number = MUSIC_CONFIG.defaultVolume;
    private paused = false;
    private nowMessage: Message | null = null;
    private progressTimer: ReturnType<typeof setInterval> | null = null;
    private statusTimer: ReturnType<typeof setInterval> | null = null;
    private idleTimer: ReturnType<typeof setTimeout> | null = null;
    private nextPromise: Promise<void> | null = null;
    private loadingTrack = false;
    /** Set while the player is stopped on purpose (stop, skip), so the Idle event doesn't move on by itself. */
    private holdIdle = false;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private suggestions: Track[] = [];
    private renderVersion = 0;
    private history: Track[] = [];
    private previousTransition = false;
    private destroyed = false;

    constructor(public settings: MusicBotSettings, private readonly token: string, private readonly hooks: MusicBotHooks) {
        this.ctx = `music:${settings.name}`;
        this.client = this.makeClient(true);

        this.player.on(AudioPlayerStatus.Idle, () => {
            if (this.holdIdle || this.loadingTrack) return;
            if (this.current) this.next().catch(e => this.warn("next", e));
        });
        this.player.on("error", e => {
            this.warn("audio player", e);
            if (!this.holdIdle && this.current && !this.loadingTrack) this.next().catch(err => this.warn("next", err));
        });

    }

    /** Its Discord client, with or without the Message Content intent. */
    private makeClient(withMessageContent: boolean): Client {
        const client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                ...(withMessageContent ? [GatewayIntentBits.MessageContent] : []),
                GatewayIntentBits.GuildVoiceStates,
            ],
        });
        client.once("clientReady", () => this.onReady().catch(e => this.warn("ready", e)));
        client.on("guildCreate", guild => this.enforceGuild(guild));
        client.on("messageCreate", message => void this.inLang(() => this.hooks.onMessage(this, message)).catch(e => this.warn("message", e)));
        client.on("interactionCreate", interaction => void this.inLang(() => this.onInteraction(interaction)).catch(e => this.warn("interaction", e)));
        client.on("error", e => this.warn("client", e));
        return client;
    }

    /** A music bot is its own client, outside the main bot's event loader, so it picks its server's language here. */
    inLang<T>(fn: () => Promise<T>): Promise<T> {
        return ServerConfigRepository.getLanguage(this.settings.guildId)
            .catch(() => null)
            .then(lang => runWithLang(lang ?? DEFAULT_LANG, fn, this.settings.guildId));
    }

    // ── what the router and the panel read ───────────────────────────────────

    get online(): boolean {
        return this.client.isReady();
    }

    /** Whether the bot account is in its assigned server yet — it may still need to be invited. */
    get inGuild(): boolean {
        return this.client.guilds.cache.has(this.settings.guildId);
    }

    /** The voice channel it's connected to right now, if any. */
    get connectedChannelId(): string | null {
        const c = this.voiceConnection;
        if (!c || c.state.status === VoiceConnectionStatus.Destroyed) return null;
        return c.joinConfig.channelId;
    }

    /** The channel that belongs to it (fixed bots only). */
    get assignedChannelId(): string | null {
        return this.settings.mode === "fixed" ? this.settings.voiceChannelId : null;
    }

    /** Playing, loading or holding a queue: a roaming bot that's busy isn't free to move. */
    get busy(): boolean {
        return !!this.current || this.queue.length > 0 || this.loadingTrack;
    }

    get isPaused(): boolean {
        return this.paused;
    }

    get nowPlayingTitle(): string | null {
        return this.current?.title ?? null;
    }

    // ── lifecycle ────────────────────────────────────────────────────────────

    /**
     * Logs in. If Discord refuses the Message Content intent (not turned on in the Developer Portal), it logs in again
     * without it: typed commands are off for this bot, the control panel works the same.
     */
    async start(): Promise<void> {
        try {
            await this.client.login(this.token);
        } catch (err) {
            if (!isDisallowedIntents(err) || this.destroyed) throw err;
            Logger.warn("Message Content intent is off in the Developer Portal — logged in without it: typed commands are off, the panel works", this.ctx);
            await this.client.destroy().catch(() => null);
            this.readsMessages = false;
            this.client = this.makeClient(false);
            await this.client.login(this.token);
        }
    }

    /** Leaves voice, stops everything, logs out. The instance can't be started again. */
    async destroy(): Promise<void> {
        this.destroyed = true;
        this.stopProgress();
        this.clearIdle();
        if (this.statusTimer) clearInterval(this.statusTimer);
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.killProcess();
        this.player.stop(true);
        this.wantChannelId = null;
        this.voiceConnection?.destroy();
        await this.nowMessage?.delete().catch(() => null);
        await this.client.destroy();
    }

    /** Removes the bot from its server (used by delete). */
    async leaveGuild(): Promise<void> {
        await this.client.guilds.cache.get(this.settings.guildId)?.leave().catch(() => null);
    }

    /** New settings from the dashboard (name, mode, channel), applied without logging out. */
    async update(next: MusicBotSettings): Promise<void> {
        const renamed = next.name !== this.settings.name;
        const before = this.assignedChannelId;
        this.settings = next;
        if (renamed) await this.client.guilds.cache.get(next.guildId)?.members.me?.setNickname(next.name).catch(() => null);
        // Its channel moved (or it turned roaming): leave the old one unless it's playing there right now.
        if (before !== this.assignedChannelId && this.connectedChannelId === before && !this.busy) this.leaveVoice();
        await this.reconcilePresence();
    }

    /**
     * Where it should be when nothing is asked of it: a fixed bot with "stay" on sits in its channel; anything else
     * that's idle in a channel leaves after a while. Run on start and on every sync.
     */
    async reconcilePresence(): Promise<void> {
        if (this.destroyed || !this.inGuild) return;
        const stay = (await MusicSettingsRepository.get(this.settings.guildId)).stay;
        const home = this.assignedChannelId;
        if (stay && home && !this.busy) {
            this.clearIdle();
            if (this.connectedChannelId !== home) await this.join(home).catch(e => this.warn("join", e));
            return;
        }
        if (!this.busy && this.connectedChannelId) this.scheduleIdleLeave();
    }

    private async onReady(): Promise<void> {
        Logger.success(`${this.client.user?.tag} online`, this.ctx);

        let statusIndex = 0;
        const updateStatus = () => {
            const name = MUSIC_CONFIG.statusRotation[statusIndex++ % MUSIC_CONFIG.statusRotation.length]!;
            this.client.user?.setPresence({ activities: [{ name, type: ActivityType.Listening }], status: "online" });
        };
        updateStatus();
        this.statusTimer = setInterval(updateStatus, MUSIC_CONFIG.statusIntervalSeconds * 1000);

        for (const guild of this.client.guilds.cache.values()) this.enforceGuild(guild);
    }

    /** A music bot belongs to one server: anywhere else, it leaves immediately. */
    private enforceGuild(guild: Guild): void {
        if (guild.id !== this.settings.guildId) {
            Logger.warn(`Added to ${guild.id}, which isn't its server — leaving`, this.ctx);
            guild.leave().catch(() => null);
            return;
        }
        void guild.members.me?.setNickname(this.settings.name).catch(() => null);
        this.reconcilePresence().catch(e => this.warn("presence", e));
    }

    // ── voice ────────────────────────────────────────────────────────────────

    /** Joins a voice channel (moving from another one if needed). Throws when the channel is gone. */
    async join(channelId: string): Promise<void> {
        if (this.destroyed) return;
        const guild = this.client.guilds.cache.get(this.settings.guildId);
        if (!guild) throw new Error(L("I'm not in this server yet", "لم تتم إضافتي إلى السيرفر بعد"));
        this.wantChannelId = channelId;
        if (this.connectedChannelId === channelId) return;

        const channel = await guild.channels.fetch(channelId).catch(() => null);
        if (!channel?.isVoiceBased()) throw new Error(L("That voice channel no longer exists", "هذه الروم الصوتية لم تعد موجودة"));

        if (this.voiceConnection && this.voiceConnection.state.status !== VoiceConnectionStatus.Destroyed) {
            this.voiceConnection.removeAllListeners();
            this.voiceConnection.destroy();
        }
        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
            selfDeaf: true,
            selfMute: false,
            group: this.settings.botId,
        });
        this.voiceConnection = connection;
        connection.subscribe(this.player);
        connection.on("error", e => this.warn("voice connection", e));
        connection.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                await Promise.race([
                    entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                    entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                ]);
            } catch {
                connection.destroy();
            }
        });
        connection.on(VoiceConnectionStatus.Destroyed, () => {
            if (this.voiceConnection === connection) this.voiceConnection = null;
            this.scheduleReconnect();
        });
        Logger.info(`Joined voice: ${channel.name}`, this.ctx);
    }

    /** Leaves voice on purpose (no reconnect). */
    leaveVoice(): void {
        this.wantChannelId = null;
        this.clearIdle();
        const c = this.voiceConnection;
        this.voiceConnection = null;
        if (c && c.state.status !== VoiceConnectionStatus.Destroyed) c.destroy();
    }

    private scheduleReconnect(): void {
        if (this.destroyed || !this.wantChannelId) return;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        const target = this.wantChannelId;
        this.reconnectTimer = setTimeout(() => {
            if (this.wantChannelId === target) this.join(target).catch(e => this.warn("reconnect", e));
        }, 3_000);
    }

    private scheduleIdleLeave(): void {
        if (this.idleTimer) return;
        this.idleTimer = setTimeout(() => {
            this.idleTimer = null;
            if (this.busy) return;
            void MusicSettingsRepository.get(this.settings.guildId).then(s => {
                if (this.busy || (s.stay && this.assignedChannelId && this.connectedChannelId === this.assignedChannelId)) return;
                this.leaveVoice();
            });
        }, MUSIC_CONFIG.idleLeaveSeconds * 1000);
    }

    private clearIdle(): void {
        if (this.idleTimer) clearTimeout(this.idleTimer);
        this.idleTimer = null;
    }

    // ── playback ─────────────────────────────────────────────────────────────

    /**
     * Plays (or queues) what someone asked for, in their voice channel. Joins (or moves to) that channel first.
     * Returns the track and whether it was queued behind the current one. Throws with a sentence to show them.
     */
    async play(query: string, request: PlayRequest): Promise<{ track: Track; queued: boolean }> {
        const results = await resolveQuery(query, MUSIC_CONFIG.suggestionCount);
        this.suggestions = results;
        const track: Track = { ...results[0]!, requestedBy: request.requestedBy, requestChannelId: request.textChannelId };
        this.clearIdle();
        const moving = !!this.connectedChannelId && this.connectedChannelId !== request.voiceChannelId;
        if (moving && this.busy) throw new Error(L("I'm playing in another channel right now", "أنا أعمل في روم أخرى حالياً"));
        await this.join(request.voiceChannelId);
        this.queue.push(track);
        if (this.current) return { track, queued: true };
        await this.next();
        return { track, queued: false };
    }

    pause(): boolean {
        const c = this.current;
        if (!c || this.paused || this.player.state.status !== AudioPlayerStatus.Playing) return false;
        c.pausedAt = Date.now();
        this.paused = true;
        this.player.pause(true);
        this.stopProgress();
        void this.renderNowPlaying(L("⏸️ Paused.", "⏸️ تم الإيقاف المؤقت.")).catch(() => null);
        return true;
    }

    resume(): boolean {
        const c = this.current;
        if (!c || !this.paused) return false;
        if (c.pausedAt && c.startedAt) c.startedAt += Date.now() - c.pausedAt;
        c.pausedAt = null;
        this.paused = false;
        this.player.unpause();
        this.startProgress();
        void this.renderNowPlaying().catch(() => null);
        return true;
    }

    /** Next in the queue; with an empty queue, one of the suggestions (autoplay). False when there's nothing to skip to. */
    skip(): boolean {
        if (!this.current) return false;
        if (!this.queue.length) {
            const pool = this.suggestions.filter(s => s?.id && s.id !== this.current?.id);
            const picked = pool[Math.floor(Math.random() * pool.length)];
            if (!picked) return false;
            this.queue.unshift({ ...picked, requestedBy: this.current.requestedBy, requestChannelId: this.current.requestChannelId });
        }
        this.paused = false;
        this.player.stop(true);
        return true;
    }

    /** Back to the previous song. */
    previous(): boolean {
        const previous = this.history.shift();
        if (!previous) return false;
        this.queue.unshift({ ...previous, requestChannelId: this.current?.requestChannelId ?? previous.requestChannelId });
        this.previousTransition = true;
        this.paused = false;
        this.player.stop(true);
        if (!this.current) void this.next().catch(e => this.warn("previous", e));
        return true;
    }

    /** Stops and clears everything. False when nothing was playing. */
    async stop(): Promise<boolean> {
        if (!this.busy) return false;
        this.holdIdle = true;
        this.queue = [];
        this.loadingTrack = false;
        this.paused = false;
        this.previousTransition = false;
        this.stopProgress();
        this.killProcess();
        this.player.stop(true);
        this.current = null;
        this.history = [];
        this.suggestions = [];
        this.volume = MUSIC_CONFIG.defaultVolume;
        this.holdIdle = false;
        if (this.nowMessage) {
            await this.nowMessage.delete().catch(() => null);
            this.nowMessage = null;
        }
        await this.reconcilePresence();
        return true;
    }

    /** Sets the volume (0 to the max); returns it. */
    setVolume(value: number): number {
        this.volume = Math.max(0, Math.min(MUSIC_CONFIG.maxVolume, Math.round(value)));
        this.activeResource?.volume?.setVolume(this.volume / 100);
        void this.renderNowPlaying().catch(() => null);
        return this.volume;
    }

    changeVolume(step: number): number {
        return this.setVolume(this.volume + step);
    }

    private elapsed(): number {
        const c = this.current;
        if (!c) return 0;
        if (this.paused) return c.pausedAt && c.startedAt ? (c.pausedAt - c.startedAt) / 1000 : 0;
        return c.startedAt ? Math.max(0, (Date.now() - c.startedAt) / 1000) : 0;
    }

    private killProcess(): void {
        try { this.currentProcess?.proc?.kill("SIGKILL"); } catch { /* already gone */ }
        try { this.currentProcess?.ffmpeg?.kill("SIGKILL"); } catch { /* already gone */ }
        this.currentProcess = null;
        this.activeResource = null;
    }

    private async playTrack(track: Track): Promise<void> {
        const c = this.current;
        if (c && c.startedAt && !this.previousTransition) {
            const { startedAt: _s, pausedAt: _p, thumbFileName: _t, ...past } = c;
            this.history = [past, ...this.history].slice(0, MUSIC_CONFIG.historyLimit);
        }
        const state: PlayingTrack = {
            ...track,
            startedAt: null,
            pausedAt: null,
            thumbFileName: `song-thumb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`,
        };
        this.previousTransition = false;
        this.current = state;
        this.paused = false;
        this.loadingTrack = true;

        const ch = track.requestChannelId ? await this.client.channels.fetch(track.requestChannelId).catch(() => null) : null;
        this.stopProgress();
        if (this.nowMessage) {
            await this.nowMessage.delete().catch(() => null);
            this.nowMessage = null;
        }

        if (ch?.isSendable()) {
            try {
                const images = await generateBanner({ track: state, elapsedSeconds: 0, volume: this.volume, thumbFileName: state.thumbFileName });
                if (this.current !== state) { this.loadingTrack = false; return; }
                this.nowMessage = await ch.send({
                    embeds: [this.makeEmbed()],
                    files: images.thumb ? [images.banner, images.thumb] : [images.banner],
                    components: this.controlRows(),
                });
            } catch (err) {
                this.warn("now playing send", err);
            }
        }

        try {
            const { stream, proc, ffmpeg, inputType } = await getAudio(track);
            if (this.current !== state) {
                try { proc?.kill("SIGKILL"); } catch { /* gone */ }
                try { ffmpeg?.kill("SIGKILL"); } catch { /* gone */ }
                this.loadingTrack = false;
                return;
            }

            this.currentProcess = { proc, ffmpeg };
            const resource = createAudioResource(stream, { inputType, inlineVolume: true });
            resource.volume?.setVolume(this.volume / 100);
            this.activeResource = resource;
            state.startedAt = Date.now();
            state.pausedAt = null;
            this.loadingTrack = false;
            this.player.play(resource);
            this.startProgress();
        } catch (error) {
            this.loadingTrack = false;
            this.stopProgress();
            if (this.current === state) {
                this.current = null;
                await this.nowMessage?.edit({
                    embeds: [new EmbedBuilder()
                        .setColor(0xed4245)
                        .setDescription(L(`❌ Couldn't play **${track.title}**.`, `❌ تعذّر تشغيل **${track.title}**.`))],
                    files: [],
                    components: [],
                }).catch(() => null);
                this.nowMessage = null;
            }
            throw error;
        }
    }

    private async next(): Promise<void> {
        if (this.nextPromise) return this.nextPromise;

        this.nextPromise = (async () => {
            this.stopProgress();
            this.loadingTrack = false;
            this.killProcess();

            while (this.queue.length) {
                const t = this.queue.shift()!;
                try {
                    await this.playTrack(t);
                    if (this.current) return;
                } catch (e) {
                    this.warn("playback", e);
                    if (this.current?.url === t.url) this.current = null;
                    await sleep(500);
                }
            }
            // The queue ran out.
            this.current = null;
            if (this.nowMessage) {
                await this.nowMessage.edit({
                    embeds: [new EmbedBuilder().setColor(MUSIC_CONFIG.embedColor).setDescription(L("⏹️ The queue has ended.", "⏹️ انتهت قائمة التشغيل."))],
                    files: [],
                    components: [],
                }).catch(() => null);
                this.nowMessage = null;
            }
            await this.reconcilePresence();
        })();

        try {
            return await this.nextPromise;
        } finally {
            this.nextPromise = null;
        }
    }

    // ── now-playing card ─────────────────────────────────────────────────────

    private controlRows() {
        const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId("prev").setEmoji("⏮️").setLabel(L("Back", "السابق")).setStyle(ButtonStyle.Secondary).setDisabled(this.history.length === 0),
            this.paused
                ? new ButtonBuilder().setCustomId("resume").setEmoji("▶️").setLabel(L("Resume", "متابعة")).setStyle(ButtonStyle.Success)
                : new ButtonBuilder().setCustomId("pause").setEmoji("⏸️").setLabel(L("Pause", "إيقاف مؤقت")).setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("skip").setEmoji("⏭️").setLabel(L("Skip", "تخطي")).setStyle(ButtonStyle.Secondary),
        );
        const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId("vdown").setEmoji("🔉").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("vup").setEmoji("🔊").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("stop").setEmoji("⏹️").setLabel(L("Stop", "إيقاف")).setStyle(ButtonStyle.Danger),
        );

        const options = (this.suggestions.length ? this.suggestions : this.current ? [this.current] : [])
            .filter(song => song?.id)
            .slice(0, MUSIC_CONFIG.suggestionCount)
            .map((song, index) => ({
                label: String(song.title || L(`Result ${index + 1}`, `نتيجة ${index + 1}`)).slice(0, 100),
                description: String(song.author || "YouTube").slice(0, 100),
                value: String(song.id),
            }));

        const rows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [row1, row2];
        if (options.length) {
            rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId("search_suggestions")
                    .setPlaceholder(L("Suggestions: pick one to add to the queue", "اقتراحات: اختر أغنية لإضافتها إلى القائمة"))
                    .addOptions(options),
            ));
        }
        return rows;
    }

    private makeEmbed(note?: string): EmbedBuilder {
        const c = this.current;
        if (!c) return new EmbedBuilder().setColor(MUSIC_CONFIG.embedColor).setDescription(L("Nothing is playing right now.", "لا يوجد تشغيل حالياً."));
        const lines = [
            `**${formatDuration(Math.min(this.elapsed(), c.durationSeconds))} / ${formatDuration(c.durationSeconds)}**  •  🔊 ${this.volume}%`,
            c.requestedBy ? L(`Requested by **${c.requestedBy}**`, `بطلب من **${c.requestedBy}**`) : "",
            this.queue.length ? L(`Up next: **${this.queue.length}**`, `التالي في القائمة: **${this.queue.length}**`) : "",
            note ?? "",
        ].filter(Boolean);
        return new EmbedBuilder()
            .setColor(MUSIC_CONFIG.embedColor)
            .setAuthor({ name: String(c.author || "YouTube").slice(0, 256) })
            .setTitle(String(c.title || "YouTube").slice(0, 256))
            .setThumbnail(`attachment://${c.thumbFileName}`)
            .setURL(c.url)
            .setDescription(lines.join("\n"))
            .setImage("attachment://banner.png")
            .setFooter({ text: MUSIC_CONFIG.bannerTitle });
    }

    private async renderNowPlaying(note?: string): Promise<void> {
        if (!this.nowMessage || !this.current) return;
        const version = ++this.renderVersion;
        const state = this.current;
        const images = await generateBanner({ track: state, elapsedSeconds: this.elapsed(), volume: this.volume, thumbFileName: state.thumbFileName });
        if (version !== this.renderVersion || !this.nowMessage || this.current !== state) return;
        await this.nowMessage.edit({
            embeds: [this.makeEmbed(note ?? (this.paused ? L("⏸️ Paused.", "⏸️ تم الإيقاف المؤقت.") : undefined))],
            files: images.thumb ? [images.banner, images.thumb] : [images.banner],
            components: this.controlRows(),
        }).catch(err => this.warn("now playing update", err));
    }

    private startProgress(): void {
        this.stopProgress();
        this.progressTimer = setInterval(() => this.renderNowPlaying().catch(() => null), MUSIC_CONFIG.progressUpdateSeconds * 1000);
    }

    private stopProgress(): void {
        if (this.progressTimer) clearInterval(this.progressTimer);
        this.progressTimer = null;
    }

    // ── the card's buttons (they belong to this bot's own client) ───────────

    private async onInteraction(interaction: Interaction): Promise<void> {
        if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;
        if (interaction.guildId !== this.settings.guildId) return;

        const voiceChannelId = interaction.inCachedGuild() ? interaction.member.voice.channelId : null;
        if (!voiceChannelId || voiceChannelId !== this.connectedChannelId) {
            await interaction.reply({ content: L("Join my voice channel to use the controls.", "يرجى الانضمام إلى رومي الصوتية لاستخدام أزرار التحكم."), flags: MessageFlags.Ephemeral }).catch(() => null);
            return;
        }

        if (interaction.isStringSelectMenu() && interaction.customId === "search_suggestions") {
            await interaction.deferUpdate().catch(() => null);
            const picked = this.suggestions.find(s => s.id === interaction.values[0]);
            if (!picked) return;
            this.queue.push({ ...picked, requestedBy: interaction.user.username, requestChannelId: interaction.channelId });
            if (!this.current) await this.next();
            else await this.renderNowPlaying().catch(() => null);
            return;
        }

        await interaction.deferUpdate().catch(() => null);
        switch (interaction.customId) {
            case "pause": this.pause(); return;
            case "resume": case "play": this.resume(); return;
            case "skip": this.skip(); return;
            case "prev": this.previous(); return;
            case "stop": await this.stop(); return;
            case "vup": this.changeVolume(MUSIC_CONFIG.volumeStep); return;
            case "vdown": this.changeVolume(-MUSIC_CONFIG.volumeStep); return;
        }
    }

    private warn(what: string, err: unknown): void {
        Logger.warn(`${what}: ${(err as Error)?.message ?? err}`, this.ctx);
    }
}
