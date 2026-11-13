import { MessageFlags, type ButtonInteraction, type GuildMember, type StringSelectMenuInteraction } from "discord.js";
import type { ComponentHandler } from "@typings/command";
import { GuildPanelRepository } from "@database/repositories";
import { Logger } from "@logger";

import { L } from "@utils";
/**
 * Buttons and menu options of a dashboard-built panel. Custom ids: `gp:<panelId>:<itemId>` for a button, and
 * `gp:<panelId>:<selectId>` for a menu (the chosen value is the option's id). Each item either replies (only the
 * clicker sees it), gives or takes a role, or does nothing; and may be limited to some roles.
 */

export const GUILD_PANEL_ID = /^gp:[\w-]{1,40}:[\w-]{1,40}$/;

interface Action { kind: "reply" | "role" | "none"; reply?: string; roleId?: string | null }
interface Item { id: string; action?: Action; allowedRoleIds?: string[]; options?: Item[]; style?: string }

/** Every button, menu and option in a panel definition, wherever it sits (rows, sections, containers). */
function collect(node: unknown, out: Item[]): void {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(n => collect(n, out)); return; }
    const o = node as Record<string, unknown>;
    if (typeof o.id === "string" && ("action" in o || "options" in o)) out.push(o as unknown as Item);
    for (const v of Object.values(o)) if (v && typeof v === "object") collect(v, out);
}

function find(definition: Record<string, unknown>, id: string): Item | null {
    const all: Item[] = [];
    collect(definition, all);
    return all.find(i => i.id === id) ?? null;
}

const allowed = (member: GuildMember, item: Item) =>
    !item.allowedRoleIds?.length || item.allowedRoleIds.some(id => member.roles.cache.has(id));

async function act(interaction: ButtonInteraction | StringSelectMenuInteraction, item: Item): Promise<void> {
    const member = interaction.member as GuildMember | null;
    if (!member) return;
    if (!allowed(member, item)) {
        await interaction.reply({ content: L("You can't use this.", "ما تقدر تستخدم هذا."), flags: MessageFlags.Ephemeral });
        return;
    }
    const action = item.action ?? { kind: "none" };
    if (action.kind === "reply" && action.reply?.trim()) {
        await interaction.reply({ content: action.reply.slice(0, 2000), flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
        return;
    }
    if (action.kind === "role" && action.roleId) {
        const has = member.roles.cache.has(action.roleId);
        try {
            if (has) await member.roles.remove(action.roleId, "Panel button");
            else await member.roles.add(action.roleId, "Panel button");
            await interaction.reply({ content: L(`${has ? "Removed" : "Added"} <@&${action.roleId}>.`, `${has ? "انسحبت" : "انضافت"} <@&${action.roleId}>.`), flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
        } catch (err) {
            Logger.warn(`Panel role toggle failed in ${interaction.guildId}: ${err}`, "panels");
            await interaction.reply({ content: L("I couldn't change that role. My role may be below it.", "ما قدرت أغير هذي الرتبة. يمكن رتبتي تحتها."), flags: MessageFlags.Ephemeral });
        }
        return;
    }
    await interaction.deferUpdate();
}

async function resolve(interaction: ButtonInteraction | StringSelectMenuInteraction) {
    const [, panelId, itemId] = interaction.customId.split(":");
    const panel = interaction.guildId ? await GuildPanelRepository.get(interaction.guildId, panelId!) : null;
    if (!panel) {
        await interaction.reply({ content: L("This panel was removed.", "هذي اللوحة انحذفت."), flags: MessageFlags.Ephemeral });
        return null;
    }
    return { definition: panel.definition, itemId: itemId! };
}

/** One handler for both, since they share the custom-id shape and the router stops at the first match. */
export const guildPanelHandler: ComponentHandler<ButtonInteraction | StringSelectMenuInteraction> = {
    customId: GUILD_PANEL_ID,
    async run(interaction: ButtonInteraction | StringSelectMenuInteraction) {
        const found = await resolve(interaction);
        if (!found) return;
        const target = find(found.definition, found.itemId);
        const item = interaction.isStringSelectMenu() ? target?.options?.find(o => o.id === interaction.values[0]) : target;
        if (!item) {
            await interaction.reply({ content: L("This was removed from the panel.", "هذا انحذف من اللوحة."), flags: MessageFlags.Ephemeral });
            return;
        }
        await act(interaction, item);
    },
};
