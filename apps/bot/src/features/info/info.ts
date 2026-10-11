import { defineFeature } from "@typings/feature";

const PANEL = { name: "panel", description: "Which info panel", type: "string", required: true, autocomplete: true } as const;

/**
 * Info panels: a message an admin builds in Discord — a description, an optional image, and
 * buttons or a menu whose every choice shows its own answer, privately, to whoever picks it.
 *
 * `/info create|update|delete` manage the panel, `/option add|remove` its choices. `modalOnly`:
 * the forms can't be shown from a prefix command, so `!info` and `!option` explain that instead.
 */
export const infoFeature = defineFeature({
    key: "info",
    description: "Info panels: buttons or a menu that answer members privately, /info and /option",
    activation: "default-on",
    commands: [
        {
            name: "info",
            description: "Create and edit info panels",
            scope: "guild",
            access: "admin",
            category: "Utility",
            modalOnly: true,
            subcommands: [
                { name: "create", description: "Create an info panel and send it to a channel" },
                { name: "update", description: "Change a panel's channel, text, type or image", options: [PANEL] },
                { name: "delete", description: "Delete an info panel and its message", options: [PANEL] },
            ],
        },
        {
            name: "option",
            description: "Add or remove the choices on an info panel",
            scope: "guild",
            access: "admin",
            category: "Utility",
            modalOnly: true,
            subcommands: [
                { name: "add", description: "Add a button or menu choice to a panel", options: [PANEL] },
                {
                    name: "remove",
                    description: "Remove a choice from a panel",
                    options: [PANEL, { name: "option", description: "Which choice", type: "string", required: true, autocomplete: true }],
                },
            ],
        },
    ],
    components: ["info"],
});
