import { ChannelType } from "discord.js";
import { defineFeature } from "@typings/feature";
import { STAFF_TIER_THRESHOLDS } from "@constants";

/**
 * Partner servers: each `/partner add` renders a banner (our logo beside theirs, on
 * `images/partner.png`), posts it in the partner channel with an Information button, and gives
 * the representative the partner role (`/partner role`) — now, or when they join.
 *
 * Manager tier and up (`requiredPermission`), as partnerships are staff business. A dedicated
 * Partner Manager role that isn't a staff tier is granted with `/command-access` rather than a
 * second permission system here.
 *
 * `modalOnly` because `add` and `edit` open a modal, which the prefix stand-in cannot show — `!partner` is
 * refused with a clear message instead of failing halfway.
 */
export const partnerFeature = defineFeature({
    key: "partner",
    description: "Partner servers: banner posts, the partner role, /partner add|edit|update|list|remove|role|channel",
    activation: "default-on",
    commands: [
        {
            name: "partner",
            description: "Manage partner servers",
            scope: "guild",
            category: "Partnership",
            requiredPermission: STAFF_TIER_THRESHOLDS.manager,
            modalOnly: true,
            subcommands: [
                { name: "add", description: "Add a partner server and post its banner" },
                {
                    name: "edit",
                    description: "Change a partner's details or logo, and its post",
                    options: [
                        { name: "partner", description: "Which partner", type: "string", required: true, autocomplete: true },
                    ],
                },
                { name: "update", description: "Redraw every partner post with the current template" },
                { name: "list", description: "Every partner server" },
                {
                    name: "remove",
                    description: "Remove a partner server and its post",
                    options: [
                        { name: "partner", description: "Which partner", type: "string", required: true, autocomplete: true },
                    ],
                },
                {
                    name: "role",
                    description: "The role partner representatives get",
                    options: [
                        { name: "role", description: "Partner role", type: "role", required: true },
                    ],
                },
                {
                    name: "channel",
                    description: "Where partner banners are posted",
                    options: [
                        { name: "channel", description: "Partner channel", type: "channel", required: true, channelTypes: [ChannelType.GuildText, ChannelType.GuildAnnouncement] },
                    ],
                },
            ],
        },
    ],
    events: ["guildMemberAdd"],
    components: ["partner"],
});
