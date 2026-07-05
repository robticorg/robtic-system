import {
    ButtonInteraction,
    MessageFlags,
    PermissionFlagsBits,
    type GuildMember,
} from "discord.js";
import type { BotClient } from "@core/BotClient";
import { AdOrderRepository, AdsConfigRepository } from "@database/repositories";
import { hasFullPower } from "@shared/utils/access";
import { buildOrderReview } from "../utils/adsOrderReview";

export default {
    customId: /^ads-order-(accept|reject)_/,

    async run(interaction: ButtonInteraction, client: BotClient) {
        const [, action, orderId] = interaction.customId.match(/^ads-order-(accept|reject)_(.+)$/) ?? [];

        const member = interaction.member as GuildMember;
        if (!member.permissions.has(PermissionFlagsBits.ManageGuild) && !hasFullPower(member)) {
            await interaction.reply({ content: "❌ You don't have permission to decide on ad orders.", flags: MessageFlags.Ephemeral });
            return;
        }

        const guildId = interaction.guildId!;
        const order = await AdOrderRepository.get(guildId, orderId);
        if (!order) {
            await interaction.reply({ content: "❌ This order no longer exists.", flags: MessageFlags.Ephemeral });
            return;
        }

        if (order.status !== "pending") {
            await interaction.reply({ content: `⚠️ This order was already ${order.status}.`, flags: MessageFlags.Ephemeral });
            return;
        }

        const status = action === "accept" ? "approved" : "rejected";
        const decided = await AdOrderRepository.decide(orderId, status, interaction.user.id);

        const config = await AdsConfigRepository.get(guildId);
        await interaction.update({
            ...buildOrderReview(decided!, config.exchangeRate),
            flags: MessageFlags.IsComponentsV2,
        });

        try {
            const user = await client.users.fetch(order.userId);
            if (status === "approved") {
                await user.send(`✅ Your ad order (total $${order.totalUsd}) has been **accepted**! Please complete payment as instructed by staff.`);
            } else {
                await user.send(`❌ Your ad order (total $${order.totalUsd}) has been **rejected**.`);
            }
        } catch {
            // User has DMs closed — ignore.
        }

        await interaction.followUp({
            content: `✅ | Order ${status}`,
            flags: MessageFlags.Ephemeral,
        });
    },
};
