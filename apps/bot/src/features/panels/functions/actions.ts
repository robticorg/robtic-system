import {
    ButtonStyle,
    MessageFlags,
    type ChatInputCommandInteraction,
    type ButtonInteraction,
    type GuildMember,
    type TextChannel,
    EmbedBuilder,
    ButtonBuilder,
    ActionRowBuilder,
} from "discord.js";
import { BRANCH_CONFIG } from "@config";
import { COLORS } from "@constants";
import { getPanel, listPanels, getPanelKeys } from "../registry";
import { ServerConfigRepository } from "@database/repositories/ServerConfigRepository";
import { getUserLang } from "@bot/utils/lang";

import { L } from "@utils";
export async function panelList(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const panels = await listPanels();
    if (!panels.length) {
        await interaction.editReply({ content: L("No panels yet.", "ما في لوحات لين الحين.") });
        return;
    }

    const sentPanels = await ServerConfigRepository.getSentPanels(interaction.guildId!);
    const lines = panels.map(p => {
        const name = p.name ?? p.key;
        const sent = sentPanels.filter(s => s.panelKey === p.key);
        const status = sent.length > 0
            ? `✅ Sent ${sent.length}x (${sent.map(s => `<#${s.channelId}>`).join(", ")})`
            : L("❌ Not sent", "❌ ما انرسلت");
        return `**${name}** (\`${p.key}\`) — ${status}`;
    });

    const embed = new EmbedBuilder()
        .setTitle(L("📋 Panels", "📋 اللوحات"))
        .setDescription(lines.join("\n"))
        .setColor(COLORS.info)
        .setFooter({ text: L(`${panels.length} panel(s) available`, `${panels.length} لوحة متاحة`) })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

export async function panelSend(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const panelKey = interaction.options.getString("panel", true);
    const panel = await getPanel(panelKey);

    if (!panel) {
        await interaction.editReply({ content: L(`Panel \`${panelKey}\` not found.`, `ما لقيت اللوحة \`${panelKey}\`.`) });
        return;
    }

    const channel = interaction.channel as TextChannel;
    const name = panel.name ?? panel.key;

    if (panel.mode === "container") {
        const container = panel.getContent("en", name);
        const msg = await channel.send({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        });

        await ServerConfigRepository.addSentPanel(interaction.guildId!, {
            panelKey: panel.key,
            channelId: channel.id,
            messageId: msg.id,
            sentBy: interaction.user.id,
        });

        await interaction.editReply({
            content: L(`✅ Panel **${name}** sent to <#${channel.id}>.`, `✅ انرسلت اللوحة **${name}** إلى <#${channel.id}>.`),
        });
        return;
    }

    const embed = new EmbedBuilder()
        .setColor(panel.accentColor ?? COLORS.default)
        .setTitle(name)
        .setDescription(panel.description ?? "")
        .setImage(`${BRANCH_CONFIG.server.githubAssetsBase}/utils/discord/rules.png`)
        .setFooter({
            text: L("Press the button below for more", "اضغط الزر تحت للمزيد")
        });

    const button = new ButtonBuilder()
        .setCustomId(`panel_view_${panel.key}`)
        .setLabel(panel.buttonLabel ?? L("Details", "التفاصيل"))
        .setEmoji(BRANCH_CONFIG.emojis.membersPanelButton)
        .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(button);

    const msg = await channel.send({
        embeds: [embed],
        components: [row],
    });

    await ServerConfigRepository.addSentPanel(interaction.guildId!, {
        panelKey: panel.key,
        channelId: channel.id,
        messageId: msg.id,
        sentBy: interaction.user.id,
    });

    await interaction.editReply({
        content: L(`✅ Panel **${name}** sent to <#${channel.id}>.`, `✅ انرسلت اللوحة **${name}** إلى <#${channel.id}>.`),
    });
}

export async function panelDelete(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const messageId = interaction.options.getString("panel_message", true);
    const guildId = interaction.guildId!;

    const sentPanel = await ServerConfigRepository.getSentPanel(guildId, messageId);
    if (!sentPanel) {
        await interaction.editReply({ content: L("That panel was not found in the database.", "ما لقيت هذي اللوحة في قاعدة البيانات.") });
        return;
    }

    try {
        const channel = await interaction.guild!.channels.fetch(sentPanel.channelId) as TextChannel | null;
        if (channel) {
            const msg = await channel.messages.fetch(messageId).catch(() => null);
            if (msg) await msg.delete();
        }
    } catch {
    }

    await ServerConfigRepository.removeSentPanel(guildId, messageId);
    const panel = await getPanel(sentPanel.panelKey);

    await interaction.editReply({
        content: `🗑️ Deleted panel **${panel?.name ?? sentPanel.panelKey}** from <#${sentPanel.channelId}>.`,
    });
}

export async function panelButtonHandler(interaction: ButtonInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const panelKey = interaction.customId.replace("panel_view_", "");

    const panel = await getPanel(panelKey);
    if (!panel) {
        await interaction.editReply({ content: L("This panel no longer exists.", "هذي اللوحة ما عادت موجودة.") });
        return;
    }

    const member = interaction.member as GuildMember;
    const lang = getUserLang(member);

    const matched = panel.roles?.find(r => member.roles.cache.has(r.roleId));
    const container = panel.getContent(await lang, matched?.label ?? null);

    await interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    });
}

export async function panelAutocompleteChoices(query: string) {
    const all = await getPanelKeys();
    if (!query) return all.slice(0, 25);
    const lower = query.toLowerCase();
    return all.filter(p => p.name.toLowerCase().includes(lower) || p.value.toLowerCase().includes(lower)).slice(0, 25);
}

export async function sentPanelAutocomplete(guildId: string, query: string) {
    const sent = await ServerConfigRepository.getSentPanels(guildId);
    const choices = await Promise.all(sent.map(async s => {
        const panel = await getPanel(s.panelKey);
        const label = `${panel?.name ?? s.panelKey} — #${s.channelId.slice(-4)} (${s.messageId.slice(-6)})`;
        return { name: label.slice(0, 100), value: s.messageId };
    }));
    if (!query) return choices.slice(0, 25);
    const lower = query.toLowerCase();
    return choices.filter(c => c.name.toLowerCase().includes(lower)).slice(0, 25);
}
