import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

/**
 * `!dm` message variables:
 *
 *   [user]          → the participant's mention
 *   [post]          → link to their post
 *   [vote]          → their vote count
 *   [Label;https://…] → a link button (up to 5) — e.g. `[Go to post;[post]]`
 */
export function renderDm(template: string, vars: { userId: string; post: string; votes: number }): { content: string; buttons: ActionRowBuilder<ButtonBuilder>[] } {
    let text = template
        .replaceAll("[user]", `<@${vars.userId}>`)
        .replaceAll("[post]", vars.post)
        .replaceAll("[vote]", String(vars.votes));

    const buttons: ButtonBuilder[] = [];
    text = text.replace(/\[([^\[\];\n]{1,80});\s*(https?:\/\/[^\s\]]+)\]/g, (_all, label: string, url: string) => {
        if (buttons.length < 5) buttons.push(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label.trim()).setURL(url));
        return "";
    });

    return {
        content: text.trim().slice(0, 2000),
        buttons: buttons.length ? [new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)] : [],
    };
}

export type DmTarget = { kind: "all" } | { kind: "number"; number: number } | { kind: "votes"; op: ">" | "<" | "="; value: number };

/** `!dm`, `!dm >N`, `!dm <N`, `!dm =N`, `!dm #N`. `null` = not understood. */
export function parseDmTarget(arg: string): DmTarget | null {
    const a = arg.replace(/\s+/g, "");
    if (!a) return { kind: "all" };
    const num = /^#(\d+)$/.exec(a);
    if (num) return { kind: "number", number: Number(num[1]) };
    const cmp = /^([<>=])(\d+)$/.exec(a);
    if (cmp) return { kind: "votes", op: cmp[1] as ">" | "<" | "=", value: Number(cmp[2]) };
    return null;
}

export function matchesTarget(target: DmTarget, entry: { number: number }, votes: number): boolean {
    switch (target.kind) {
        case "all": return true;
        case "number": return entry.number === target.number;
        case "votes":
            return target.op === ">" ? votes > target.value : target.op === "<" ? votes < target.value : votes === target.value;
    }
}
