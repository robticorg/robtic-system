import { ChannelType } from "discord.js";
import { defineFeature } from "@typings/feature";

export const boostFeature = defineFeature({
    key: "boost",
    description: "Boost thank-you messages, /boost channel",
    activation: "default-on",
    commands: [
        {
            name: "boost",
            description: "Boost thank-you messages",
            scope: "guild",
            access: "admin",
            category: "Configuration",
            subcommands: [
                {
                    name: "channel",
                    description: "Where boosts are thanked (leave empty to stop)",
                    options: [
                        { name: "channel", description: "Thank-you channel", type: "channel", channelTypes: [ChannelType.GuildText, ChannelType.GuildAnnouncement] },
                    ],
                },
            ],
        },
    ],
    events: ["messageCreate", "guildMemberUpdate"],
});
