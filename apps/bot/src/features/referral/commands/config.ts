import type { FeatureSubcommandHandler } from "@typings/feature";
import { REWARD_REFERRAL_BONUS } from "@constants";
import { normalizeReferralCode, referralPercentToBp } from "@core/rewards";
import { ReferralCodeRepository, ReferralCodeUseRepository } from "@database/repositories";
import { formatReferralPercent } from "../utils/referral-format";

/** Admin-only (`access: "admin"`). Every value is validated here before it reaches the database. */

const MAX = formatReferralPercent(REWARD_REFERRAL_BONUS.maxBp);
const BAD_CODE = "Codes are 3–20 letters, numbers, `-` or `_`.";

/** The `bonus` option as basis points: `undefined` if not given, `null` if out of range. */
function bonusOption(interaction: Parameters<FeatureSubcommandHandler>[0]): number | null | undefined {
    const percent = interaction.options.getNumber("bonus");
    return percent === null ? undefined : referralPercentToBp(percent);
}

export const create: FeatureSubcommandHandler = async (interaction, _client) => {
    const code = normalizeReferralCode(interaction.options.getString("code", true));
    if (!code) return void await interaction.editReply({ content: BAD_CODE });

    const bonus = bonusOption(interaction);
    if (bonus === null) return void await interaction.editReply({ content: `The bonus must be between 0% and ${MAX}.` });

    const owner = interaction.options.getUser("owner", true);
    const created = await ReferralCodeRepository.create({
        guildId: interaction.guildId!,
        code,
        ownerId: owner.id,
        bonusBp: bonus ?? REWARD_REFERRAL_BONUS.defaultBp,
        createdBy: interaction.user.id,
    });

    await interaction.editReply({
        content: created
            ? `Created **${code}** for <@${owner.id}> — **+${formatReferralPercent(created.bonusBp)}**, active.`
            : `A code named **${code}** already exists.`,
        allowedMentions: { parse: [] },
    });
};

export const edit: FeatureSubcommandHandler = async (interaction, _client) => {
    const code = normalizeReferralCode(interaction.options.getString("code", true));
    if (!code) return void await interaction.editReply({ content: BAD_CODE });

    const bonus = bonusOption(interaction);
    if (bonus === null) return void await interaction.editReply({ content: `The bonus must be between 0% and ${MAX}.` });

    const active = interaction.options.getBoolean("active");
    const owner = interaction.options.getUser("owner");
    const changes = {
        ...(active !== null ? { active } : {}),
        ...(bonus !== undefined ? { bonusBp: bonus } : {}),
        ...(owner ? { ownerId: owner.id } : {}),
    };
    if (!Object.keys(changes).length) return void await interaction.editReply({ content: "Nothing to change — set `active`, `bonus` or `owner`." });

    const updated = await ReferralCodeRepository.update(interaction.guildId!, code, changes);
    await interaction.editReply({
        content: updated
            ? `**${code}** — ${updated.active ? "active" : "inactive"}, **+${formatReferralPercent(updated.bonusBp)}**, owner <@${updated.ownerId}>. Members' next rewards use this.`
            : `No code named **${code}**.`,
        allowedMentions: { parse: [] },
    });
};

export const remove: FeatureSubcommandHandler = async (interaction, _client) => {
    const code = normalizeReferralCode(interaction.options.getString("code", true));
    const deleted = code ? await ReferralCodeRepository.delete(interaction.guildId!, code) : null;

    await interaction.editReply({
        content: deleted
            ? `Deleted **${deleted.code}**. Its members now get +0% and may apply another code.`
            : "No such code.",
    });
};

export const list: FeatureSubcommandHandler = async (interaction, _client) => {
    const codes = await ReferralCodeRepository.list(interaction.guildId!);
    if (!codes.length) return void await interaction.editReply({ content: "No referral codes yet. Create one with `/referral-config create`." });

    const counts = await Promise.all(codes.map(c => ReferralCodeUseRepository.countByCode(String(c._id))));
    const lines = codes.map((c, i) =>
        `**${c.code}** · <@${c.ownerId}> · +${formatReferralPercent(c.bonusBp)} · ${c.active ? "active" : "inactive"} · ${counts[i]} member${counts[i] === 1 ? "" : "s"}`);

    await interaction.editReply({ content: lines.join("\n").slice(0, 2000), allowedMentions: { parse: [] } });
};

export const reset: FeatureSubcommandHandler = async (interaction, _client) => {
    const user = interaction.options.getUser("user", true);
    const cleared = await ReferralCodeUseRepository.clear(interaction.guildId!, user.id);

    await interaction.editReply({
        content: cleared ? `<@${user.id}> no longer uses a referral code and may apply another.` : `<@${user.id}> doesn't use a referral code.`,
        allowedMentions: { parse: [] },
    });
};
