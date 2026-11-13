import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    AutocompleteInteraction,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    LabelBuilder,
    EmbedBuilder,
    MessageFlags,
} from "discord.js";
import { COLORS, PUNISH_TITLES } from "@constants";
import { ReasonRepository } from "@database/repositories";
import { L, currentLang, errorText } from "@utils";

/** Discord's limit for one field's text. */
const FIELD_MAX = 1024;

/** Splits lines into field-sized blocks, so a long list never breaks the reply. */
function chunk(lines: string[]): string[] {
    const blocks: string[] = [];
    let current = "";
    for (const line of lines) {
        const next = current ? `${current}\n${line}` : line;
        if (next.length > FIELD_MAX) {
            if (current) blocks.push(current);
            current = line.slice(0, FIELD_MAX);
        } else current = next;
    }
    if (current) blocks.push(current);
    return blocks;
}

export default {
    scope: "guild",
    category: "Moderation",
    data: new SlashCommandBuilder()
        .setName("reason")
        .setDescription("Manage punishment reasons")
        .addSubcommand(sub =>
            sub.setName("create")
                .setDescription("Create a new punishment reason")
                .addStringOption(opt =>
                    opt.setName("type").setDescription("Punishment type").setRequired(true)
                        .addChoices({ name: "Warning", value: "warn" }, { name: "Mute", value: "mute" }, { name: "Jail", value: "ban" })
                )
        )
        .addSubcommand(sub =>
            sub.setName("remove")
                .setDescription("Remove a punishment reason")
                .addStringOption(opt => opt.setName("key").setDescription("The reason key to remove").setRequired(true).setAutocomplete(true))
        )
        .addSubcommand(sub => sub.setName("list").setDescription("List all punishment reasons")),

    requiredPermission: 80,

    modalOnlySubcommands: ["create"],

    async run(interaction: ChatInputCommandInteraction) {
        const sub = interaction.options.getSubcommand();
        if (!interaction.guildId) return;

        if (sub === "create") {
            const type = interaction.options.getString("type", true);
            const text = (id: string, max: number, placeholder: string) =>
                new TextInputBuilder().setCustomId(id).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(max).setPlaceholder(placeholder);

            await interaction.showModal(
                new ModalBuilder()
                    .setCustomId(`reason_create_${type}`)
                    .setTitle(L("New punishment reason", "سبب عقوبة جديد"))
                    .addLabelComponents(
                        new LabelBuilder()
                            .setLabel(L("Key", "المفتاح"))
                            .setDescription(L("Short id: letters, numbers and dashes", "معرف قصير: حروف إنجليزية وأرقام وشرطات"))
                            .setTextInputComponent(text("reason_key", 30, "spam")),
                        new LabelBuilder().setLabel(L("Reason in English", "السبب بالإنجليزي")).setTextInputComponent(text("reason_label", 200, "Spamming in channels")),
                        new LabelBuilder().setLabel(L("Reason in Arabic", "السبب بالعربي")).setTextInputComponent(text("reason_label_ar", 200, "إرسال رسائل مزعجة")),
                    ),
            );
            return;
        }

        if (sub === "remove") {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const key = interaction.options.getString("key", true).toLowerCase().trim();

            const deleted = await ReasonRepository.delete(key, interaction.guildId);
            if (!deleted) {
                const shared = await ReasonRepository.isShared(key);
                await interaction.editReply({
                    content: errorText(shared
                        ? L(`\`${key}\` is a shared default, so it can't be removed here. Add your own reason with the same key to replace it.`, `\`${key}\` سبب افتراضي مشترك، ما ينحذف من هنا. أضف سبب بنفس المفتاح عشان يستبدله.`)
                        : L(`There's no reason \`${key}\`.`, `ما في سبب اسمه \`${key}\`.`)),
                });
                return;
            }

            await interaction.editReply({
                embeds: [new EmbedBuilder().setTitle(L("✅ Reason removed", "✅ تم حذف السبب")).setDescription(L(`\`${key}\` was deleted.`, `تم حذف \`${key}\`.`)).setColor(COLORS.success).setTimestamp()],
            });
            return;
        }

        if (sub === "list") {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const reasons = await ReasonRepository.getAll(interaction.guildId);
            if (!reasons.length) {
                await interaction.editReply({ content: L("No punishment reasons yet. Add one with /reason create.", "ما في أسباب عقوبات لين الحين. أضف واحد بـ /reason create.") });
                return;
            }

            const ar = currentLang() === "ar";
            const line = (r: { key: string; label: string; labelAr: string }) => `\`${r.key}\` — ${ar ? r.labelAr || r.label : r.label}`;
            const fields: { name: string; value: string }[] = [];
            for (const type of ["warn", "mute", "ban"] as const) {
                const blocks = chunk(reasons.filter(r => r.type === type).map(line));
                blocks.forEach((value, i) => fields.push({ name: i === 0 ? PUNISH_TITLES[type] : "​", value }));
            }

            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(L("📋 Punishment reasons", "📋 أسباب العقوبات"))
                        .addFields(fields.slice(0, 25))
                        .setColor(COLORS.info)
                        .setFooter({ text: L(`${reasons.length} reason(s)`, `${reasons.length} سبب`) })
                        .setTimestamp(),
                ],
            });
        }
    },

    async autocomplete(interaction: AutocompleteInteraction) {
        const focused = interaction.options.getFocused().toLowerCase();
        if (!interaction.guildId) return interaction.respond([]);
        const keys = await ReasonRepository.getAllKeys(interaction.guildId);
        await interaction.respond(keys.filter(k => k.includes(focused)).slice(0, 25).map(k => ({ name: k.slice(0, 100), value: k.slice(0, 100) })));
    },
};
