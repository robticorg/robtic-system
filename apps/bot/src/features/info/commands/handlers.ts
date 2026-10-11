import { MessageFlags, type AutocompleteInteraction, type GuildMember } from "discord.js";
import type { FeatureSubcommandHandler } from "@typings/feature";
import type { IInfoPanel } from "@database/models";
import { InfoPanelRepository } from "@database/repositories";
import { hasGuildBotAdmin, isGuildOperator } from "@bot/utils/access";
import { buildInfoOptionModal, buildInfoPanelModal } from "../utils/info-form";
import { INFO_MAX_OPTIONS } from "../utils/info-render";
import { syncInfoPanel } from "../utils/info-post";

const NO_PANEL = "No such info panel — pick one from the list.";

/** The forms check again on submit: a command's permission check doesn't cover the modal it opened. */
export async function canManageInfo(member: GuildMember | null): Promise<boolean> {
    return Boolean(member && (isGuildOperator(member) || await hasGuildBotAdmin(member)));
}

/** `/info create` — the empty form. */
export const create: FeatureSubcommandHandler = async interaction => {
    await interaction.showModal(buildInfoPanelModal());
};

/** `/info update panel:` — the same form, prefilled. */
export const update: FeatureSubcommandHandler = async interaction => {
    const panel = await InfoPanelRepository.get(interaction.guildId!, interaction.options.getString("panel", true));
    if (!panel) return void await interaction.reply({ content: NO_PANEL, flags: MessageFlags.Ephemeral });
    await interaction.showModal(buildInfoPanelModal(panel));
};

/** `/info delete panel:` — the panel and its message. */
export const remove: FeatureSubcommandHandler = async interaction => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const panel = await InfoPanelRepository.delete(interaction.guildId!, interaction.options.getString("panel", true));
    if (!panel) return void await interaction.editReply({ content: NO_PANEL });

    let note = "";
    if (panel.messageId) {
        const channel = await interaction.guild!.channels.fetch(panel.channelId).catch(() => null);
        const deleted = channel?.isTextBased() ? await channel.messages.delete(panel.messageId).then(() => true, () => false) : false;
        if (!deleted) note = " Its message couldn't be deleted — remove it by hand if it's still there.";
    }
    await interaction.editReply({ content: `The info panel was deleted.${note}` });
};

/** `/option add panel:` — the choice form. */
export const optionAdd: FeatureSubcommandHandler = async interaction => {
    const panel = await InfoPanelRepository.get(interaction.guildId!, interaction.options.getString("panel", true));
    if (!panel) return void await interaction.reply({ content: NO_PANEL, flags: MessageFlags.Ephemeral });
    if (panel.options.length >= INFO_MAX_OPTIONS) {
        return void await interaction.reply({ content: `This panel already has ${INFO_MAX_OPTIONS} options — Discord's limit.`, flags: MessageFlags.Ephemeral });
    }
    await interaction.showModal(buildInfoOptionModal(panel));
};

/** `/option remove panel: option:` */
export const optionRemove: FeatureSubcommandHandler = async interaction => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const guildId = interaction.guildId!;
    const panelId = interaction.options.getString("panel", true);
    const optionId = interaction.options.getString("option", true);

    const before = await InfoPanelRepository.getLight(guildId, panelId);
    if (!before) return void await interaction.editReply({ content: NO_PANEL });
    const option = before.options.find(o => o.optionId === optionId);
    if (!option) return void await interaction.editReply({ content: "That panel has no such option — pick one from the list." });

    const panel = await InfoPanelRepository.removeOption(guildId, panelId, optionId);
    if (!panel) return void await interaction.editReply({ content: NO_PANEL });

    const sync = await syncInfoPanel(interaction.guild!, panel);
    await interaction.editReply({
        content: `Removed **${option.label}**.${sync.ok ? "" : ` ⚠️ The panel message wasn't updated: ${sync.problem}`}`,
        allowedMentions: { parse: [] },
    });
};

function panelLabel(interaction: AutocompleteInteraction, panel: IInfoPanel): string {
    const channel = interaction.guild?.channels.cache.get(panel.channelId);
    const text = panel.description.replace(/\s+/g, " ").trim();
    return `#${channel?.name ?? "deleted-channel"} · ${panel.type} · ${text}`.slice(0, 100);
}

/** Panels for `panel:`, and the chosen panel's options for `option:`. */
export async function infoAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focused = interaction.options.getFocused(true);
    const query = focused.value.toLowerCase();

    if (focused.name === "option") {
        const panel = await InfoPanelRepository.getLight(interaction.guildId!, interaction.options.getString("panel") ?? "");
        const options = (panel?.options ?? []).filter(o => o.label.toLowerCase().includes(query)).slice(0, 25);
        await interaction.respond(options.map(o => ({ name: `${o.emoji ? `${o.emoji} ` : ""}${o.label}`.slice(0, 100), value: o.optionId })));
        return;
    }

    const panels = await InfoPanelRepository.list(interaction.guildId!, 100);
    const matches = panels
        .map(p => ({ name: panelLabel(interaction, p), value: String(p._id) }))
        .filter(m => m.name.toLowerCase().includes(query))
        .slice(0, 25);
    await interaction.respond(matches);
}
