import {
    FileUploadBuilder,
    LabelBuilder,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    type GuildMember,
    type UserContextMenuCommandInteraction,
} from "discord.js";
import type { PunishType } from "@typings/punishment";
import { L, errorText } from "@utils";
import { punishBlocker } from "@bot/commands/guild/admin/moderation/warn.command";
import { MUTE_MAX_HOURS } from "@bot/commands/guild/admin/moderation/mute.command";
import { JAIL_MAX_DAYS } from "@bot/commands/guild/admin/moderation/jail.command";
import { needsProof } from "./needs-proof";

/** Words that mean a permanent jail in the length box. */
const PERMANENT_WORDS = new Set(["perm", "permanent", "دائم", "دايم"]);

/** Hours for a mute from the form: a whole number from 1 to 672, empty = 24. Null when it's anything else. */
export function parseMuteHours(input: string): number | null {
    const text = input.trim();
    if (!text) return 24;
    if (!/^\d+$/.test(text)) return null;
    const hours = Number(text);
    return hours >= 1 && hours <= MUTE_MAX_HOURS ? hours : null;
}

/** A jail length from the form: "perm" (or دائم) or 1 to 365 days, empty = permanent. Null when it's anything else. */
export function parseJailLength(input: string): { permanent: true } | { permanent: false; days: number } | null {
    const text = input.trim().toLowerCase();
    if (!text || PERMANENT_WORDS.has(text)) return { permanent: true };
    if (!/^\d+$/.test(text)) return null;
    const days = Number(text);
    return days >= 1 && days <= JAIL_MAX_DAYS ? { permanent: false, days } : null;
}

const text = (id: string, style: TextInputStyle, required: boolean, value?: string) => {
    const input = new TextInputBuilder().setCustomId(id).setStyle(style).setRequired(required);
    if (id === "reason") input.setMaxLength(500);
    if (value) input.setValue(value);
    return input;
};

/**
 * The right-click punish form (Warn / Mute / Jail User). Refuses first, privately, when the moderator may not punish
 * this member (themselves, a bot, someone at or above them); otherwise opens a form for the reason, the length for
 * mute and jail, and a proof image when the moderator needs one. `punish-modal.component.ts` handles the answer.
 */
export async function openPunishForm(interaction: UserContextMenuCommandInteraction, type: PunishType): Promise<void> {
    const moderator = interaction.member as GuildMember | null;
    const target = interaction.targetMember as GuildMember | null;
    const blocked = punishBlocker(moderator, target, interaction.targetUser.bot);
    if (blocked) {
        await interaction.reply({ content: errorText(blocked), flags: MessageFlags.Ephemeral });
        return;
    }

    const name = interaction.targetUser.username;
    const title = type === "warn" ? L(`Warn ${name}`, `تحذير ${name}`) : type === "mute" ? L(`Mute ${name}`, `ميوت ${name}`) : L(`Jail ${name}`, `سجن ${name}`);
    const modal = new ModalBuilder().setCustomId(`punish_modal_${type}_${interaction.targetId}`).setTitle(title.slice(0, 45));

    modal.addLabelComponents(
        new LabelBuilder()
            .setLabel(L("Reason", "السبب"))
            .setDescription(L("Type the reason, or a reason key from /reason list", "اكتب السبب، أو مفتاح سبب من /reason list"))
            .setTextInputComponent(text("reason", TextInputStyle.Paragraph, true)),
    );
    if (type === "mute") {
        modal.addLabelComponents(
            new LabelBuilder()
                .setLabel(L("Hours", "عدد الساعات"))
                .setDescription(L(`1 to ${MUTE_MAX_HOURS}. Empty = 24`, `من 1 إلى ${MUTE_MAX_HOURS}. فاضي = 24`))
                .setTextInputComponent(text("duration", TextInputStyle.Short, false, "24")),
        );
    }
    if (type === "ban") {
        modal.addLabelComponents(
            new LabelBuilder()
                .setLabel(L("Length", "المدة"))
                .setDescription(L(`"perm", or 1 to ${JAIL_MAX_DAYS} days`, `"perm" أو "دائم"، أو من 1 إلى ${JAIL_MAX_DAYS} يوم`))
                .setTextInputComponent(text("duration", TextInputStyle.Short, true, "perm")),
        );
    }
    if (moderator && await needsProof(moderator)) {
        modal.addLabelComponents(
            new LabelBuilder()
                .setLabel(L("Proof image", "صورة الدليل"))
                .setDescription(L("A screenshot showing why", "صورة توضح السبب"))
                .setFileUploadComponent(new FileUploadBuilder().setCustomId("proof").setMinValues(1).setMaxValues(1).setRequired(true)),
        );
    }

    await interaction.showModal(modal);
}
