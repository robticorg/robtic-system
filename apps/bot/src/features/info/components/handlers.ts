import {
    MessageFlags,
    type ButtonInteraction,
    type GuildMember,
    type ModalSubmitInteraction,
    type StringSelectMenuInteraction,
} from "discord.js";
import type { ComponentHandler } from "@typings/command";
import { InfoPanelRepository } from "@database/repositories";
import { Logger } from "@logger";
import { canManageInfo } from "../commands/handlers";
import {
    INFO_CREATE_MODAL_ID,
    INFO_OPTION_MODAL_ID,
    INFO_UPDATE_MODAL_ID,
    readInfoOptionForm,
    readInfoPanelForm,
} from "../utils/info-form";
import { buildInfoPanelMessage, buildInfoReply, INFO_BUTTON_ID, INFO_MAX_OPTIONS, INFO_MENU_ID } from "../utils/info-render";
import { syncInfoPanel } from "../utils/info-post";

const EPHEMERAL = { flags: MessageFlags.Ephemeral } as const;
const NOT_ADMIN = "❌ Only server admins can manage info panels.";
const GONE = "This info panel no longer exists.";

async function guard(interaction: ModalSubmitInteraction): Promise<boolean> {
    await interaction.deferReply(EPHEMERAL);
    if (await canManageInfo(interaction.member as GuildMember | null)) return true;
    await interaction.editReply({ content: NOT_ADMIN });
    return false;
}

/** `/info create` submitted: store the panel, then post it. */
export const infoCreateModalHandler: ComponentHandler<ModalSubmitInteraction> = {
    customId: new RegExp(`^${INFO_CREATE_MODAL_ID}$`),

    async run(interaction: ModalSubmitInteraction) {
        if (!await guard(interaction)) return;
        const form = await readInfoPanelForm(interaction);
        if ("problem" in form) return void await interaction.editReply({ content: form.problem });
        const { channelId, description, type, image } = form.values;

        const panel = await InfoPanelRepository.create({
            guildId: interaction.guildId!,
            channelId,
            description,
            type,
            image: image?.data ?? null,
            imageName: image?.name ?? null,
            createdBy: interaction.user.id,
        });

        const sync = await syncInfoPanel(interaction.guild!, panel);
        if (!sync.ok) {
            await InfoPanelRepository.delete(panel.guildId, String(panel._id));
            return void await interaction.editReply({ content: `❌ ${sync.problem}` });
        }
        await interaction.editReply({ content: `✅ Info panel sent to <#${channelId}>. Add its ${type === "menu" ? "menu choices" : "buttons"} with \`/option add\`.` });
    },
};

/** `/info update` submitted: store the changes, then edit (or move) the panel's message. */
export const infoUpdateModalHandler: ComponentHandler<ModalSubmitInteraction> = {
    customId: INFO_UPDATE_MODAL_ID,

    async run(interaction: ModalSubmitInteraction) {
        if (!await guard(interaction)) return;
        const guildId = interaction.guildId!;
        const panelId = interaction.customId.split(":")[2]!;

        const before = await InfoPanelRepository.getLight(guildId, panelId);
        if (!before) return void await interaction.editReply({ content: GONE });

        const form = await readInfoPanelForm(interaction);
        if ("problem" in form) return void await interaction.editReply({ content: form.problem });
        const { channelId, description, type, image } = form.values;

        const panel = await InfoPanelRepository.update(guildId, panelId, {
            channelId,
            description,
            type,
            ...(image === undefined ? {} : { image: image?.data ?? null, imageName: image?.name ?? null }),
        });
        if (!panel) return void await interaction.editReply({ content: GONE });

        const sync = await syncInfoPanel(interaction.guild!, panel, before.channelId);
        await interaction.editReply({
            content: sync.ok
                ? `✅ Info panel updated${sync.how === "posted" ? ` and posted in <#${channelId}>` : ""}.`
                : `⚠️ Saved, but the panel message wasn't updated: ${sync.problem}`,
        });
    },
};

/** `/option add` submitted: add the choice, then redraw the panel — undone if Discord refuses it. */
export const infoOptionModalHandler: ComponentHandler<ModalSubmitInteraction> = {
    customId: INFO_OPTION_MODAL_ID,

    async run(interaction: ModalSubmitInteraction) {
        if (!await guard(interaction)) return;
        const guildId = interaction.guildId!;
        const panelId = interaction.customId.split(":")[2]!;

        const form = readInfoOptionForm(interaction);
        if ("problem" in form) return void await interaction.editReply({ content: form.problem });

        const before = await InfoPanelRepository.getLight(guildId, panelId);
        if (!before) return void await interaction.editReply({ content: GONE });
        if (before.options.length >= INFO_MAX_OPTIONS) {
            return void await interaction.editReply({ content: `This panel already has ${INFO_MAX_OPTIONS} options — Discord's limit.` });
        }

        const panel = await InfoPanelRepository.addOption(guildId, panelId, form.option);
        if (!panel) return void await interaction.editReply({ content: GONE });

        const sync = await syncInfoPanel(interaction.guild!, panel);
        if (!sync.ok) {
            const reverted = await InfoPanelRepository.removeOption(guildId, panelId, form.option.optionId);
            if (reverted) await syncInfoPanel(interaction.guild!, reverted);
            return void await interaction.editReply({ content: `❌ The option wasn't added. ${sync.problem}` });
        }
        await interaction.editReply({ content: `✅ Added **${form.option.label}** to the panel.`, allowedMentions: { parse: [] } });
    },
};

/** A button on a panel — anyone may press it; the answer is only theirs. */
export const infoButtonHandler: ComponentHandler<ButtonInteraction> = {
    customId: INFO_BUTTON_ID,

    async run(interaction: ButtonInteraction) {
        const [, , panelId, optionId] = interaction.customId.split(":");
        const panel = await InfoPanelRepository.getLight(interaction.guildId!, panelId!);
        const option = panel?.options.find(o => o.optionId === optionId);
        if (!option) return void await interaction.reply({ content: "This option is no longer available.", ...EPHEMERAL });
        await interaction.reply(buildInfoReply(option));
    },
};

/** Panels whose menu is waiting to be reset, so a burst of picks resets it once. */
const pendingReset = new Set<string>();
const MENU_RESET_MS = 5_000;

/**
 * Discord keeps showing a member's pick in the menu, so picking the same entry again does nothing.
 * Five seconds after a pick the panel is redrawn, which clears it — at most once per 5s per panel.
 */
function scheduleMenuReset(interaction: StringSelectMenuInteraction, panelId: string): void {
    if (pendingReset.has(panelId)) return;
    pendingReset.add(panelId);
    setTimeout(async () => {
        pendingReset.delete(panelId);
        try {
            const panel = await InfoPanelRepository.get(interaction.guildId!, panelId);
            if (!panel || panel.messageId !== interaction.message.id) return;
            await interaction.message.edit({ ...buildInfoPanelMessage(panel), attachments: [] });
        } catch (err) {
            Logger.warn(`Info panel ${panelId} menu could not be reset: ${err}`, "info");
        }
    }, MENU_RESET_MS).unref?.();
}

/** A pick from a panel's menu — the answer is only theirs. */
export const infoMenuHandler: ComponentHandler<StringSelectMenuInteraction> = {
    customId: INFO_MENU_ID,

    async run(interaction: StringSelectMenuInteraction) {
        const panelId = interaction.customId.split(":")[2]!;
        const panel = await InfoPanelRepository.getLight(interaction.guildId!, panelId);
        const option = panel?.options.find(o => o.optionId === interaction.values[0]);
        if (!option) await interaction.reply({ content: "This option is no longer available.", ...EPHEMERAL });
        else await interaction.reply(buildInfoReply(option));
        scheduleMenuReset(interaction, panelId);
    },
};
