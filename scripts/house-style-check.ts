/**
 * Verifies the house style: embeds become valid V2 containers (checked with discord.js's own builders, which apply
 * Discord's rules), mentions in embeds never ping, oversized bodies fall back to embeds, and plain edits of a V2
 * message become containers.
 */
import "./_english";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, createComponentBuilder } from "discord.js";
import { contentToV2, embedsToV2, IS_COMPONENTS_V2 } from "@core/style";
import { bilingual, L, runWithLang } from "@utils";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failures++;
};
const valid = (components: unknown[]) => {
    try {
        for (const c of components) createComponentBuilder(c as never).toJSON();
        return true;
    } catch (e) {
        console.log(e);
        return false;
    }
};

const embed = new EmbedBuilder()
    .setAuthor({ name: "Robtic" })
    .setTitle("🔨 Ban")
    .setDescription("<@111111111111111111> was banned by <@222222222222222222>.")
    .addFields({ name: "Reason", value: "Spam", inline: true }, { name: "Duration", value: "7 days", inline: true }, { name: "Case", value: "#12" })
    .setThumbnail("https://cdn.discordapp.com/embed/avatars/0.png")
    .setImage("attachment://card.png")
    .setFooter({ text: "Robtic System" })
    .setTimestamp(new Date("2026-11-13T12:00:00Z"));
const row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId("x").setLabel("Undo").setStyle(ButtonStyle.Danger));

{
    const out = embedsToV2({ content: "Hey <@333333333333333333>", embeds: [embed.toJSON()], components: [row.toJSON()], flags: 64 }, 0xe5212d)!;
    check("converted", out !== null && out.embeds === undefined && out.content === undefined);
    check("V2 flag added, ephemeral kept", (Number(out.flags) & IS_COMPONENTS_V2) !== 0 && (Number(out.flags) & 64) !== 0);
    check("every component is valid for Discord", valid(out.components!));
    const container = out.components![1] as { type: number; accent_color: number; components: Array<{ type: number }> };
    check("content first, then the container", (out.components![0] as { type: number }).type === 10 && container.type === 17);
    check("server colour down the side", container.accent_color === 0xe5212d);
    check("thumbnail → section", container.components[0]!.type === 9);
    check("buttons inside the container", container.components.some(c => c.type === 1));
    check("image → gallery", container.components.some(c => c.type === 12));
    check("only the content's mention may ping", JSON.stringify(out.allowed_mentions?.users) === '["333333333333333333"]' && out.allowed_mentions?.roles?.length === 0, JSON.stringify(out.allowed_mentions));
}

{
    const out = embedsToV2({ embeds: [embed.toJSON()], allowed_mentions: { parse: [] } }, 1)!;
    check("parse:[] keeps everything silent", out.allowed_mentions?.users?.length === 0);
}

{
    const huge = new EmbedBuilder().setDescription("x".repeat(4096)).addFields({ name: "a", value: "y".repeat(1000) });
    check("too much text falls back to embeds", embedsToV2({ embeds: [huge.toJSON()] }, 1) === null);
    const many = new EmbedBuilder().setTitle("t").addFields(Array.from({ length: 25 }, (_, i) => ({ name: `f${i}`, value: "v" })));
    const manyOut = embedsToV2({ embeds: [many.toJSON()] }, 1);
    check("25 fields still fit or fall back cleanly", manyOut === null || valid(manyOut.components!));
}

{
    const out = contentToV2({ content: "Done ✅", components: [row.toJSON()] }, 5);
    check("plain edit of a V2 message → container", (out.components![0] as { type: number }).type === 17 && valid(out.components!));
    const kept = contentToV2({ content: "hi", components: [{ type: 17, components: [{ type: 10, content: "x" }] }] }, 5);
    check("an existing container isn't wrapped again", (kept.components![0] as { type: number }).type === 10 && (kept.components![1] as { type: number }).type === 17);
}

{
    const MSG = bilingual({ hi: "Hello", n: (x: number) => `${x} members` }, { hi: "أهلا", n: (x: number) => `${x} عضو` });
    check("bilingual: English", runWithLang("en", () => MSG.hi === "Hello" && MSG.n(3) === "3 members"));
    check("bilingual: Arabic", runWithLang("ar", () => MSG.hi === "أهلا" && MSG.n(3) === "3 عضو"));
    check("L()", runWithLang("en", () => L("a", "b")) === "a" && runWithLang("ar", () => L("a", "b")) === "b");
    check("language follows awaits", await runWithLang("en", async () => { await new Promise(r => setTimeout(r, 5)); return L("en", "ar"); }) === "en");
}

// The installed wrappers, over recording stubs (no Discord): which calls become V2 and which are left alone.
{
    const { BaseGuildTextChannel, ChatInputCommandInteraction, CommandInteraction, Message, MessageFlags } = await import("discord.js");
    const { installHouseStyle } = await import("@core/style");
    const seen: Record<string, unknown> = {};
    const stub = (name: string) => function (this: unknown, options: unknown) { seen[name] = options; return Promise.resolve(options); };
    (BaseGuildTextChannel.prototype as any).send = stub("send");
    (Message.prototype as any).edit = stub("edit");
    (CommandInteraction.prototype as any).reply = stub("reply");
    (CommandInteraction.prototype as any).editReply = stub("editReply");
    (CommandInteraction.prototype as any).deferReply = function () { return Promise.resolve(); };
    installHouseStyle(() => 0xabcdef);

    const isV2 = (o: any) => (Number(o?.flags ?? 0) & IS_COMPONENTS_V2) !== 0;
    const channel = Object.create(BaseGuildTextChannel.prototype, { guildId: { value: "1" } });
    await channel.send({ embeds: [embed] });
    check("channel.send with an embed → V2", isV2(seen.send) && (seen.send as any).embeds === undefined);
    await channel.send({ content: "plain" });
    check("plain text messages stay plain", !isV2(seen.send) && (seen.send as any).content === "plain");

    const v2Message = Object.create(Message.prototype, { guildId: { value: "1" }, flags: { value: { has: (f: number) => f === MessageFlags.IsComponentsV2 } } });
    await v2Message.edit({ content: "edited" });
    check("editing a V2 message with text → container", isV2(seen.edit) && (seen.edit as any).components?.[0]?.type === 17);
    const oldMessage = Object.create(Message.prototype, { guildId: { value: "1" }, flags: { value: { has: () => false } } });
    await oldMessage.edit({ embeds: [embed] });
    check("editing an older embed message keeps it an embed", !isV2(seen.edit) && Array.isArray((seen.edit as any).embeds));

    const interaction = Object.create(ChatInputCommandInteraction.prototype, { id: { value: "i1" }, guildId: { value: "1" } });
    await interaction.deferReply();
    await interaction.editReply({ embeds: [embed] });
    check("a deferred reply edited with an embed → V2", isV2(seen.editReply));
    await interaction.editReply({ content: "done" });
    check("…and later text edits of it stay V2", isV2(seen.editReply));
    const plainFirst = Object.create(ChatInputCommandInteraction.prototype, { id: { value: "i2" }, guildId: { value: "1" } });
    await plainFirst.reply({ content: "hi" });
    await plainFirst.editReply({ embeds: [embed] });
    check("a plain reply edited with an embed stays an embed (Discord can't switch it)", !isV2(seen.editReply));
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
