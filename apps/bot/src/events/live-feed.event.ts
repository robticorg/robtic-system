import { Events } from "discord.js";
import type { EventConfig } from "@typings/event";
import { liveBump } from "@database/live-feed";

/**
 * The dashboard's live numbers for voice and members (messages are bumped in message-stats.event.ts, voice time in the
 * voice tick). Bots don't count, the same as everywhere else in the stats.
 */
export default [
    {
        name: Events.VoiceStateUpdate,
        execute: (oldState, newState) => {
            if (newState.member?.user.bot) return;
            const guildId = newState.guild.id;
            if (!oldState.channelId && newState.channelId) liveBump(guildId, "voiceJoin");
            else if (oldState.channelId && !newState.channelId) liveBump(guildId, "voiceLeave");
        },
    } satisfies EventConfig<Events.VoiceStateUpdate>,

    {
        name: Events.GuildMemberAdd,
        execute: member => {
            if (!member.user.bot) liveBump(member.guild.id, "memberJoin");
        },
    } satisfies EventConfig<Events.GuildMemberAdd>,

    {
        name: Events.GuildMemberRemove,
        execute: member => {
            if (!member.user?.bot) liveBump(member.guild.id, "memberLeave");
        },
    } satisfies EventConfig<Events.GuildMemberRemove>,
];
