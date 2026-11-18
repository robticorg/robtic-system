import { defineFeature } from "@typings/feature";

/**
 * Auto reply: a member's message matches a rule's trigger → the bot answers with one of its replies (and/or a
 * reaction). Rules are made on the dashboard (System → Tools → Auto reply) and stored in `autoreplies`.
 *
 * `default-on`, like shortcuts: nothing happens until a server adds a rule, and a server without rules costs one
 * cached query every 30 s. The dashboard's switch writes the same `autoreply` key to `guildfeatures`.
 *
 * Not the same as shortcuts (a phrase that runs a command): when both match, the shortcut wins.
 */
export const autoreplyFeature = defineFeature({
    key: "autoreply",
    description: "Answers messages that match your triggers",
    activation: "default-on",
    commands: [],
    events: ["messageCreate"],
});
