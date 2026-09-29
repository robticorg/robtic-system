import { ChannelType } from "discord.js";
import { defineFeature } from "@typings/feature";

const USER_OPTION = { name: "user", description: "Member to check (defaults to yourself)", type: "user" } as const;

/**
 * Invites — who brought whom into the server.
 *
 * Tracking itself (`invites.event.ts`) is always on, because the Invite reward bonus depends on it;
 * this feature's toggle only governs what members see: the join announcements and the two
 * commands. `default-on` because announcing needs a channel set first anyway, so nothing is posted
 * until an admin asks for it.
 */
export const invitesFeature = defineFeature({
    key: "invites",
    description: "Invite tracking: join/leave announcements, /invites and /info",
    activation: "default-on",
    commands: [
        {
            name: "invites",
            description: "A member's invite counts on this server",
            scope: "guild",
            access: "general",
            category: "Activity",
            options: [USER_OPTION],
        },
        {
            name: "info",
            description: "Everyone a member has invited",
            scope: "guild",
            access: "general",
            category: "Activity",
            options: [USER_OPTION],
        },
        {
            name: "invites-config",
            description: "Configure invite tracking",
            scope: "guild",
            access: "admin",
            category: "Configuration",
            subcommands: [
                {
                    name: "channel",
                    description: "Where each join is announced (leave empty to stop announcing)",
                    options: [
                        { name: "channel", description: "Announcement channel", type: "channel", channelTypes: [ChannelType.GuildText] },
                    ],
                },
            ],
        },
    ],
    events: ["clientReady", "guildCreate", "guildDelete", "guildMemberAdd", "guildMemberRemove", "channelCreate", "channelDelete", "messageCreate"],
    components: ["invites"],
});
