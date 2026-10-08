import { Events } from "discord.js";
import type { EventConfig } from "@typings/event";
import { handleError, BotError } from "@core/handlers";
import { MusicBotRepository } from "@database/repositories";
import { Logger } from "@logger";
import { startAllMusicBots } from "@core/music";
import { musicApi } from "@internal-client";
import { musicRunsLocally } from "./utils/music-backend";
import { grantVoicePermissions } from "./utils/voice-permissions";

const CTX = "main/music";

export default [
    /**
     * On start: make sure every music bot has its voice-channel permissions (only the main bot can
     * set them), and restart any music bot that is offline. With the music app, bots already online
     * keep playing — a Gateway restart never stops them. Locally (no music app) this process runs
     * the bots itself.
     */
    {
        name: Events.ClientReady,
        once: true,
        execute: client => {
            void (async () => {
                if (musicRunsLocally()) await startAllMusicBots();
                else {
                    await musicApi
                        .ensureAll()
                        .catch(err => Logger.warn(`Couldn't ask the music app to restart offline music bots: ${err}`, "music"));
                }
                for (const record of await MusicBotRepository.listAll()) {
                    const guild = client.guilds.cache.get(record.guildId);
                    if (guild) await grantVoicePermissions(guild, record);
                }
            })().catch(err => handleError(new BotError(`Failed to start music bots: ${err}`, "EVENT"), CTX));
        },
    } satisfies EventConfig<Events.ClientReady>,

    /**
     * A music bot was just invited: give it its voice-channel permissions — Discord only allows a
     * member overwrite once it is actually in the server.
     */
    {
        name: Events.GuildMemberAdd,
        execute: async member => {
            if (!member.user.bot) return;
            try {
                const record = await MusicBotRepository.findByBotId(member.id);
                if (!record || record.guildId !== member.guild.id) return;

                const problem = await grantVoicePermissions(member.guild, record);
                if (problem) Logger.warn(`Music bot ${record.name} joined ${member.guild.id}, but ${problem}`, "music");
                else Logger.info(`Music bot ${record.name} joined ${member.guild.id} — voice permissions granted`, "music");
            } catch (err) {
                handleError(new BotError(`Failed to set up a joining music bot: ${err}`, "EVENT"), CTX);
            }
        },
    } satisfies EventConfig<Events.GuildMemberAdd>,
];
