import { MessageFlags } from "discord.js";
import type { FeatureSubcommandHandler } from "@typings/feature";
import { applyReferralCode, getMemberReferral, referralCodeBonusBp } from "@core/rewards";
import { applyDecisionMessage, formatReferralPercent } from "../utils/referral-format";

/** `/referral use code:` — every rule is checked by `applyReferralCode`, not here. */
export const use: FeatureSubcommandHandler = async (interaction, _client) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const { decision, code } = await applyReferralCode(interaction.guildId!, interaction.user.id, interaction.options.getString("code", true));
    await interaction.editReply({ content: applyDecisionMessage(decision, code, referralCodeBonusBp(code)) });
};

/** `/referral info` — the member's code and what it gives them right now. */
export const info: FeatureSubcommandHandler = async (interaction, _client) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const { code, bonusBp } = await getMemberReferral(interaction.guildId!, interaction.user.id);
    const content = !code
        ? "You don't use a referral code. Apply one with `/referral use`."
        : code.active
            ? `You use the code **${code.code}** — **+${formatReferralPercent(bonusBp)}** on every reward.`
            : `You use the code **${code.code}**, but it isn't active right now, so it gives **+0%**.`;

    await interaction.editReply({ content });
};
