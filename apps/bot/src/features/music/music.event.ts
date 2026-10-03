import { Events } from "discord.js";
import type { EventConfig } from "@typings/event";
import { handleError, BotError } from "@core/handlers";
import { MusicBotRepository } from "@database/repositories";
import { Logger } from "@logger";
import { grantVoicePermissions, startAllMusicBots } from "./engine/music-manager";

const CTX = "main/music";

export default [
    /** Every saved music bot comes back online with the main bot. */
    {
        name: Events.ClientReady,
        once: true,
        execute: client => {
            startAllMusicBots(client).catch(err => handleError(new BotError(`Failed to start music bots: ${err}`, "EVENT"), CTX));
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
