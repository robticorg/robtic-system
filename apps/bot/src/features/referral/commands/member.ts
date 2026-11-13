import { MessageFlags } from "discord.js";
import type { FeatureSubcommandHandler } from "@typings/feature";
import { applyReferralCode, getMemberReferral, referralCodeBonusBp } from "@core/rewards";
import { applyDecisionMessage, formatReferralPercent } from "../utils/referral-format";

import { L } from "@utils";
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
        ? L("You don't use a referral code. Apply one with `/referral use`.", "ما تستخدم كود إحالة. استخدم واحد بـ `/referral use`.")
        : code.active
            ? L(`You use the code **${code.code}**: **+${formatReferralPercent(bonusBp)}** on every reward.`, `تستخدم الكود **${code.code}**: **+${formatReferralPercent(bonusBp)}** على كل مكافأة.`)
            : L(`You use the code **${code.code}**, but it isn't active right now, so it gives **+0%**.`, `تستخدم الكود **${code.code}**، بس هو غير فعال الحين، فيعطي **+0%**.`);

    await interaction.editReply({ content });
};
