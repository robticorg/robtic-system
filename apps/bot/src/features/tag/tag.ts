import { ChannelType } from "discord.js";
import { defineFeature } from "@typings/feature";

/**
 * Server tags across the network. A member who wears the server tag of **any** whitelisted server
 * gets the tag role of **every** whitelisted server they are in — each server picks its own role
 * with `/tag setup`, and optionally a channel where each change is logged. A server with no tag
 * role, or with no tag of its own, is simply skipped.
 */
export const tagFeature = defineFeature({
    key: "tag",
    description: "Server-tag role: wear the tag of any of the bot's servers, get each server's tag role — /tag setup",
    activation: "default-on",
    commands: [
        {
            name: "tag",
            description: "Server-tag role",
            scope: "guild",
            access: "admin",
            category: "Configuration",
            subcommands: [
                {
                    name: "setup",
                    description: "Role for members wearing the tag of any of my servers (leave empty to stop)",
                    options: [
                        { name: "role", description: "Tag role", type: "role" },
                        { name: "log", description: "Channel where tag-role changes are logged (optional)", type: "channel", channelTypes: [ChannelType.GuildText, ChannelType.GuildAnnouncement] },
                    ],
                },
            ],
        },
    ],
    events: ["clientReady", "userUpdate", "guildMemberAdd"],
});
