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
import { generateBanner } from "./banner";
import { formatDuration, getAudio, searchVideos, type AudioSource, type Track } from "./youtube";

export interface MusicBotSettings {
    botId: string;
    name: string;
    guildId: string;
    voiceChannelId: string;
}

interface PlayingTrack extends Track {
    startedAt: number | null;
    pausedAt: number | null;
    stopped: boolean;
    thumbFileName: string;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * One music bot: its own Discord client, voice connection, queue and now-playing message.
 * Ported from the standalone RobTic Music bot, where all of this was module-level state — here
 * each instance is independent, so any number can run side by side.
 *
 * It only ever works in its assigned guild and voice channel: it leaves any other server it is
 * added to, and only answers people in its voice channel, in that channel's chat.
 */
export class MusicBotInstance {
    readonly client: Client;
    private readonly ctx: string;
    private readonly player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });

    private voiceConnection: VoiceConnection | null = null;
    private queue: Track[] = [];
    private current: PlayingTrack | null = null;
    private currentProcess: Pick<AudioSource, "proc" | "ffmpeg"> | null = null;
    private activeResource: AudioResource | null = null;
    private volume: number = MUSIC_CONFIG.defaultVolume;
    private paused = false;
    private manualStop = false;
    private nowMessage: Message | null = null;
    private progressTimer: ReturnType<typeof setInterval> | null = null;
    private statusTimer: ReturnType<typeof setInterval> | null = null;
    private nextPromise: Promise<void> | null = null;
    private loadingTrack = false;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private suggestions: Track[] = [];
    private renderVersion = 0;
    private history: Track[] = [];
    private previousTransition = false;
    private destroyed = false;

    constructor(readonly settings: MusicBotSettings, private readonly token: string) {
        this.ctx = `music:${settings.name}`;
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildVoiceStates,
            ],
        });

        this.player.on(AudioPlayerStatus.Idle, () => {
            if (this.manualStop || this.loadingTrack) return;
            if (this.current) this.next().catch(e => this.warn("next", e));
        });
        this.player.on("error", e => {
            this.warn("audio player", e);
            if (!this.manualStop && this.current && !this.loadingTrack) this.next().catch(err => this.warn("next", err));
        });

        this.client.once("clientReady", () => this.onReady().catch(e => this.warn("ready", e)));
        this.client.on("guildCreate", guild => this.enforceGuild(guild));
        this.client.on("messageCreate", message => this.onMessage(message).catch(e => this.warn("message", e)));
        this.client.on("interactionCreate", interaction => this.onInteraction(interaction).catch(e => this.warn("interaction", e)));
        this.client.on("error", e => this.warn("client", e));
    }

    get online(): boolean {
        return this.client.isReady();
    }

    /** Whether the bot account is in its assigned server yet — it may still need to be invited. */
    get inGuild(): boolean {
        return this.client.guilds.cache.has(this.settings.guildId);
    }

    async start(): Promise<void> {
        await this.client.login(this.token);
    }

    /** Leaves voice, stops everything, logs out. The instance can't be started again. */
    async destroy(): Promise<void> {
        this.destroyed = true;
        this.stopProgress();
        if (this.statusTimer) clearInterval(this.statusTimer);
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.killProcess();
        this.player.stop(true);
        this.voiceConnection?.destroy();
        await this.nowMessage?.delete().catch(() => null);
        await this.client.destroy();
    }

    /** Removes the bot from its server (used by `/bot remove`). */
    async leaveGuild(): Promise<void> {
        await this.client.guilds.cache.get(this.settings.guildId)?.leave().catch(() => null);
    }

    // ── lifecycle ────────────────────────────────────────────────────────────

    private async onReady(): Promise<void> {
        Logger.success(`${this.client.user?.tag} online`, this.ctx);

        let statusIndex = 0;
        const updateStatus = () => {
            const name = MUSIC_CONFIG.statusRotation[statusIndex++ % MUSIC_CONFIG.statusRotation.length]!;
            this.client.user?.setPresence({ activities: [{ name, type: ActivityType.Playing }], status: "online" });
        };
        updateStatus();
        this.statusTimer = setInterval(updateStatus, MUSIC_CONFIG.statusIntervalSeconds * 1000);

        for (const guild of this.client.guilds.cache.values()) this.enforceGuild(guild);
        await this.joinAssignedServer();
    }

    /** A music bot belongs to one server: anywhere else, it leaves immediately. */
    private enforceGuild(guild: Guild): void {
        if (guild.id !== this.settings.guildId) {
            Logger.warn(`Added to ${guild.id}, which isn't its server — leaving`, this.ctx);
            guild.leave().catch(() => null);
            return;
        }
        this.joinAssignedServer().catch(e => this.warn("join", e));
    }

    private async joinAssignedServer(): Promise<void> {
        const guild = this.client.guilds.cache.get(this.settings.guildId);
        if (!guild) return;
        await guild.members.me?.setNickname(this.settings.name).catch(() => null);
        await this.join24();
    }

    // ── voice ────────────────────────────────────────────────────────────────

    private async join24(): Promise<void> {
        if (this.destroyed) return;
        const guild = this.client.guilds.cache.get(this.settings.guildId);
        if (!guild) return;
        const channel = await guild.channels.fetch(this.settings.voiceChannelId).catch(() => null);
        if (!channel?.isVoiceBased()) throw new Error("the assigned voice channel is gone");
        if (this.voiceConnection && this.voiceConnection.state.status !== VoiceConnectionStatus.Destroyed) return;

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
        connection.on(VoiceConnectionStatus.Destroyed, () => this.scheduleReconnect());
        Logger.info(`Joined 24/7 voice: ${channel.name}`, this.ctx);
    }

    private scheduleReconnect(): void {
        if (this.destroyed) return;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => this.join24().catch(e => this.warn("reconnect", e)), 3_000);
    }

    // ── playback ─────────────────────────────────────────────────────────────

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
        if (c && c.startedAt && !this.previousTransition && !c.stopped) {
            const { startedAt: _s, pausedAt: _p, stopped: _st, thumbFileName: _t, ...past } = c;
            this.history = [past, ...this.history].slice(0, MUSIC_CONFIG.historyLimit);
        }
        const state: PlayingTrack = {
            ...track,
            startedAt: null,
            pausedAt: null,
            stopped: false,
            thumbFileName: `song-thumb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`,
        };
        this.previousTransition = false;
        this.current = state;
        this.paused = false;
        this.manualStop = false;
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
            if (this.current !== state || this.manualStop) {
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
                        .setDescription(`❌ تعذر تشغيل **${track.title}**\n\n${String((error as Error).message || error).slice(0, 1500)}`)],
                    files: [],
                    components: [],
                }).catch(() => null);
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
            this.current = null;
        })();

        try {
            return await this.nextPromise;
        } finally {
            this.nextPromise = null;
        }
    }

    // ── now playing message ──────────────────────────────────────────────────

    private controlRows() {
        const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId("skip").setLabel("تخطي ⏭️").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("prev").setLabel("السابق ⏮️").setStyle(ButtonStyle.Secondary).setDisabled(this.history.length === 0),
            new ButtonBuilder().setCustomId("play").setLabel("تشغيل ▶️").setStyle(ButtonStyle.Success),
        );
        const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId("stop").setLabel("توقف ⏹️").setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId("vdown").setLabel("تقليل صوت 🔉").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("vup").setLabel("زيادة صوت 🔊").setStyle(ButtonStyle.Secondary),
        );

        const options = (this.suggestions.length ? this.suggestions : this.current ? [this.current] : [])
            .filter(song => song?.id)
            .slice(0, MUSIC_CONFIG.suggestionCount)
            .map((song, index) => ({
                label: String(song.title || `نتيجة ${index + 1}`).slice(0, 100),
                description: String(song.author || "YouTube").slice(0, 100),
                value: String(song.id),
            }));

        const rows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [row1, row2];
        if (options.length) {
            rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId("search_suggestions")
                    .setPlaceholder("Suggested videos — pick one to add to queue")
                    .addOptions(options),
            ));
        }
        return rows;
    }

    private makeEmbed(): EmbedBuilder {
        const c = this.current;
        if (!c) return new EmbedBuilder().setColor(MUSIC_CONFIG.embedColor).setDescription("لا يوجد شيء يعمل حاليًا.");
        return new EmbedBuilder()
            .setColor(MUSIC_CONFIG.embedColor)
            .setAuthor({ name: String(c.author || "YouTube").slice(0, 256) })
            .setTitle(String(c.title || "YouTube").slice(0, 256))
            .setThumbnail(`attachment://${c.thumbFileName}`)
            .setURL(c.url)
            .setDescription(`**${c.author || "YouTube"}**\n\n**${formatDuration(Math.min(this.elapsed(), c.durationSeconds))} / ${formatDuration(c.durationSeconds)}**  •  🔊 ${this.volume}%`)
            .setImage("attachment://banner.png")
            .setFooter({ text: MUSIC_CONFIG.bannerTitle });
    }

    private async renderNowPlaying(): Promise<void> {
        if (!this.nowMessage || !this.current) return;
        const version = ++this.renderVersion;
        const state = this.current;
        const images = await generateBanner({ track: state, elapsedSeconds: this.elapsed(), volume: this.volume, thumbFileName: state.thumbFileName });
        if (version !== this.renderVersion || !this.nowMessage || this.current !== state) return;
        await this.nowMessage.edit({
            embeds: [this.makeEmbed()],
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

    // ── commands ─────────────────────────────────────────────────────────────

    /** In its own voice channel, and in that channel's chat — the only place it listens. */
    private inMyVoice(memberVoiceChannelId: string | null | undefined): boolean {
        return memberVoiceChannelId === this.settings.voiceChannelId;
    }

    private async onMessage(message: Message): Promise<void> {
        if (message.author.bot || message.guildId !== this.settings.guildId) return;
        if (message.channelId !== this.settings.voiceChannelId) return;

        const content = message.content.trim();
        const startsWith = (p: string) => content === p || content.startsWith(`${p} `);

        if (MUSIC_CONFIG.stopPrefixes.some(p => content === p)) {
            if (!this.inMyVoice(message.member?.voice.channelId)) return;
            if (!this.current || this.manualStop || this.player.state.status !== AudioPlayerStatus.Playing) return;

            this.queue = [];
            this.manualStop = true;
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
            if (this.nowMessage) {
                await this.nowMessage.delete().catch(() => null);
                this.nowMessage = null;
            }
            await message.reply("⏹️ تم إيقاف التشغيل ومسح القائمة.").catch(() => null);
            return;
        }

        const volumeHit = MUSIC_CONFIG.volumePrefixes.find(startsWith);
        if (volumeHit) {
            if (!this.inMyVoice(message.member?.voice.channelId)) return;
            const raw = content.slice(volumeHit.length).trim();
            const value = Number(raw);
            if (!Number.isFinite(value) || !/^\d+(?:\.\d+)?$/.test(raw)) {
                await message.reply(`اكتب مستوى الصوت من 0 إلى ${MUSIC_CONFIG.maxVolume}. مثال: \`صوت 70\``).catch(() => null);
                return;
            }
            this.volume = Math.max(0, Math.min(MUSIC_CONFIG.maxVolume, value));
            this.activeResource?.volume?.setVolume(this.volume / 100);
            await this.renderNowPlaying().catch(() => null);
            await message.reply(`🔊 مستوى الصوت: **${this.volume}%**`).catch(() => null);
            return;
        }

        const hit = MUSIC_CONFIG.playPrefixes.find(startsWith);
        if (!hit || !this.inMyVoice(message.member?.voice.channelId)) return;

        const query = content.slice(hit.length).trim();
        if (!query) {
            await message.reply("اكتب اسم الأغنية بعد الأمر. مثال: `ش عزرائيل`").catch(() => null);
            return;
        }

        try {
            const results = await searchVideos(query, MUSIC_CONFIG.suggestionCount);
            this.suggestions = results;
            const first = { ...results[0]!, requestedBy: message.author.username, requestChannelId: message.channelId };
            this.queue.push(first);
            await this.join24();

            if (!this.current || this.manualStop) {
                if (this.manualStop) this.current = null;
                await this.next();
            } else {
                await message.reply(`➕ اتضافت: **${first.title}**`).catch(() => null);
            }
        } catch (e) {
            this.warn("play command", e);
            await message.reply(`❌ ${(e as Error).message}`).catch(() => null);
        }
    }

    private async onInteraction(interaction: Interaction): Promise<void> {
        if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;
        if (interaction.guildId !== this.settings.guildId) return;

        const voiceChannelId = interaction.inCachedGuild() ? interaction.member.voice.channelId : null;
        if (!this.inMyVoice(voiceChannelId)) {
            await interaction.reply({ content: "يجب أن تكون في نفس الروم الصوتية لاستخدام التحكم!", flags: MessageFlags.Ephemeral }).catch(() => null);
            return;
        }

        if (interaction.isStringSelectMenu() && interaction.customId === "search_suggestions") {
            await interaction.deferUpdate().catch(() => null);
            const picked = this.suggestions.find(s => s.id === interaction.values[0]);
            if (!picked) return;
            this.queue.push({ ...picked, requestedBy: interaction.user.username, requestChannelId: interaction.channelId });
            if (!this.current) await this.next();
            return;
        }

        await interaction.deferUpdate().catch(() => null);
        const c = this.current;

        switch (interaction.customId) {
            case "play": {
                if (!c) return;
                if (this.player.state.status === AudioPlayerStatus.Paused) {
                    if (c.pausedAt && c.startedAt) c.startedAt += Date.now() - c.pausedAt;
                    c.pausedAt = null;
                    c.stopped = false;
                    this.paused = false;
                    this.manualStop = false;
                    this.player.unpause();
                    this.startProgress();
                    await this.renderNowPlaying();
                } else if (this.manualStop && this.currentProcess?.proc) {
                    this.manualStop = false;
                    c.stopped = false;
                    this.paused = false;
                    this.player.unpause();
                    this.startProgress();
                    await this.renderNowPlaying();
                }
                return;
            }
            case "skip": {
                let pool = this.suggestions.filter(s => s?.id && s.id !== c?.id);
                if (!pool.length) pool = this.suggestions.filter(s => s?.id);
                if (pool.length) {
                    const picked = pool[Math.floor(Math.random() * pool.length)]!;
                    this.queue.unshift({ ...picked, requestChannelId: c?.requestChannelId || interaction.channelId });
                    this.player.stop(true);
                }
                return;
            }
            case "stop": {
                this.queue = [];
                this.manualStop = true;
                if (c && this.player.state.status === AudioPlayerStatus.Playing) {
                    c.pausedAt = Date.now();
                    c.stopped = true;
                    this.paused = true;
                    this.player.pause(true);
                }
                this.stopProgress();
                await this.nowMessage?.edit({
                    embeds: [this.makeEmbed().setDescription("⏹️ تم إيقاف الأغنية مؤقتًا. اضغط تشغيل للمتابعة.")],
                    components: this.controlRows(),
                }).catch(() => null);
                return;
            }
            case "vup":
            case "vdown": {
                const step = interaction.customId === "vup" ? MUSIC_CONFIG.volumeStep : -MUSIC_CONFIG.volumeStep;
                this.volume = Math.max(0, Math.min(MUSIC_CONFIG.maxVolume, this.volume + step));
                this.activeResource?.volume?.setVolume(this.volume / 100);
                await this.renderNowPlaying();
                return;
            }
            case "prev": {
                const previous = this.history.shift();
                if (!previous) return;
                this.queue.unshift({ ...previous, requestChannelId: c?.requestChannelId || interaction.channelId });
                this.previousTransition = true;
                this.player.stop(true);
                await this.next();
                return;
            }
        }
    }

    private warn(what: string, err: unknown): void {
        Logger.warn(`${what}: ${(err as Error)?.message ?? err}`, this.ctx);
    }
}
