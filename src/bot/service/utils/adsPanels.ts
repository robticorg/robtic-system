import { existsSync } from "fs";
import path from "path";
import {
    AttachmentBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    StringSelectMenuBuilder,
    type BaseMessageOptions,
} from "discord.js";
import type { IAdItem, IAdsConfig } from "@database/models/AdsConfig";
import { formatPrice } from "./pricing";
import type { CartItem } from "./cartStore";

const BANNER_PATH = path.join(process.cwd(), "images", "ads-banner.png");

function priceList(items: IAdItem[], rate: number): string {
    return items.map(i => `• **${i.name}** — ${formatPrice(i.priceUsd, rate)}`).join("\n");
}

/** The public ordering panel — banner, rules, prices, package buttons, add-ons select. */
export function buildAdsPanel(config: IAdsConfig): { components: ContainerBuilder[]; files: AttachmentBuilder[] } {
    const files: AttachmentBuilder[] = [];
    const container = new ContainerBuilder().setAccentColor(0x2ecc71);

    if (existsSync(BANNER_PATH)) {
        const banner = new AttachmentBuilder(BANNER_PATH, { name: "ads-banner.png" });
        files.push(banner);
        container.addMediaGalleryComponents(mg =>
            mg.addItems(item => item.setURL("attachment://ads-banner.png").setDescription("Robtic Advertisements"))
        );
    }

    container.addTextDisplayComponents(td => td.setContent("# 📢 Ads"));
    container.addSeparatorComponents(sep => sep);

    container.addSectionComponents(sc =>
        sc.addTextDisplayComponents(td =>
            td.setContent("Before ordering, please make sure to read our advertisement rules.")
        ).setButtonAccessory(btn =>
            btn.setCustomId("ads-rules-view").setLabel("📜 View Ad Rules").setStyle(ButtonStyle.Secondary)
        )
    );
    container.addSeparatorComponents(sep => sep);

    const priceLines = [
        "## 💰 Advertisement Prices",
        priceList(config.standardAds, config.exchangeRate),
        "",
        priceList(config.giveaway, config.exchangeRate),
    ].join("\n");
    container.addTextDisplayComponents(td => td.setContent(priceLines));
    container.addSeparatorComponents(sep => sep);

    container.addTextDisplayComponents(td =>
        td.setContent("## 📦 Packages\nPick a pack below to see what's included and add it to your order.")
    );
    if (config.packages.length) {
        container.addActionRowComponents(row =>
            row.setComponents(
                config.packages.slice(0, 5).map(p =>
                    new ButtonBuilder()
                        .setCustomId(`ads-pack_${p.key}`)
                        .setLabel(`${p.name} — ${formatPrice(p.priceUsd, config.exchangeRate)}`.slice(0, 80))
                        .setStyle(ButtonStyle.Primary)
                )
            )
        );
    }
    container.addSeparatorComponents(sep => sep);

    container.addTextDisplayComponents(td =>
        td.setContent("## ➕ Add-ons\nAnything extra you want to add? Pick it below to add it to your order.")
    );
    if (config.addons.length) {
        container.addActionRowComponents(row =>
            row.setComponents(
                new StringSelectMenuBuilder()
                    .setCustomId("ads-select-addon")
                    .setPlaceholder("Select an add-on to add to your order")
                    .addOptions(
                        config.addons.slice(0, 25).map(a => ({
                            label: a.name.slice(0, 100),
                            value: a.key,
                            description: formatPrice(a.priceUsd, config.exchangeRate),
                        }))
                    )
            )
        );
    }

    return { components: [container], files };
}

export function buildRulesContainer(): BaseMessageOptions {
    const container = new ContainerBuilder()
        .setAccentColor(0xed4245)
        .addTextDisplayComponents(td => td.setContent("## 📜 Advertisement Rules"))
        .addSeparatorComponents(sep => sep)
        .addTextDisplayComponents(td =>
            td.setContent(
                "• Payment must be completed before publishing.\n" +
                "• Advertisements must follow the community rules.\n" +
                "• Robtic may reject any advertisement that violates our policies.\n" +
                "• Prices may change based on the Credits exchange rate."
            )
        );

    return { components: [container] };
}

export function buildPackageDetail(item: IAdItem, rate: number): BaseMessageOptions {
    const container = new ContainerBuilder()
        .setAccentColor(0x5865F2)
        .addTextDisplayComponents(td => td.setContent(`## ${item.name}`))
        .addSeparatorComponents(sep => sep)
        .addTextDisplayComponents(td => td.setContent(item.details || "*No details set.*"))
        .addSeparatorComponents(sep => sep)
        .addTextDisplayComponents(td => td.setContent(`**Price:** ${formatPrice(item.priceUsd, rate)}`))
        .addActionRowComponents(row =>
            row.setComponents(
                new ButtonBuilder()
                    .setCustomId(`ads-cart-add_packages_${item.key}`)
                    .setLabel("🛒 Add to Cart")
                    .setStyle(ButtonStyle.Success)
            )
        );

    return { components: [container] };
}

export function buildCartSummary(cart: CartItem[], rate: number, note?: string): BaseMessageOptions {
    const container = new ContainerBuilder().setAccentColor(0x2ecc71);

    if (note) {
        container.addTextDisplayComponents(td => td.setContent(note));
        container.addSeparatorComponents(sep => sep);
    }

    container.addTextDisplayComponents(td => td.setContent("## 🛒 Your Cart"));

    if (!cart.length) {
        container.addTextDisplayComponents(td => td.setContent("*Your cart is empty.*"));
        return { components: [container] };
    }

    const lines = cart.map(i => `• **${i.name}** — ${formatPrice(i.priceUsd, rate)}`).join("\n");
    const total = cart.reduce((sum, i) => sum + i.priceUsd, 0);

    container.addTextDisplayComponents(td => td.setContent(lines));
    container.addSeparatorComponents(sep => sep);
    container.addTextDisplayComponents(td => td.setContent(`**Total:** ${formatPrice(total, rate)}`));
    container.addActionRowComponents(row =>
        row.setComponents(
            new ButtonBuilder().setCustomId("ads-cart-confirm").setLabel("✅ Confirm Order").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("ads-cart-clear").setLabel("🗑️ Clear Cart").setStyle(ButtonStyle.Danger)
        )
    );

    return { components: [container] };
}
