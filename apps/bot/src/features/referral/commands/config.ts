import type { FeatureSubcommandHandler } from "@typings/feature";
import { REWARD_REFERRAL_BONUS } from "@constants";
import { normalizeReferralCode, referralPercentToBp } from "@core/rewards";
import { ReferralCodeRepository, ReferralCodeUseRepository } from "@database/repositories";
import { formatReferralPercent } from "../utils/referral-format";

import { L } from "@utils";
/** Admin-only (`access: "admin"`). Every value is validated here before it reaches the database. */

const MAX = formatReferralPercent(REWARD_REFERRAL_BONUS.maxBp);
const BAD_CODE = () => L("Codes are 3–20 letters, numbers, `-` or `_`.", "الكود من 3 إلى 20 حرف إنجليزي أو رقم أو `-` أو `_`.");

/** The `bonus` option as basis points: `undefined` if not given, `null` if out of range. */
function bonusOption(interaction: Parameters<FeatureSubcommandHandler>[0]): number | null | undefined {
    const percent = interaction.options.getNumber("bonus");
    return percent === null ? undefined : referralPercentToBp(percent);
}

export const create: FeatureSubcommandHandler = async (interaction, _client) => {
    const code = normalizeReferralCode(interaction.options.getString("code", true));
    if (!code) return void await interaction.editReply({ content: BAD_CODE() });

    const bonus = bonusOption(interaction);
    if (bonus === null) return void await interaction.editReply({ content: L(`The bonus must be between 0% and ${MAX}.`, `الزيادة لازم تكون بين 0% و ${MAX}.`) });

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
            : L(`A code named **${code}** already exists.`, `في كود اسمه **${code}** من قبل.`),
        allowedMentions: { parse: [] },
    });
};

export const edit: FeatureSubcommandHandler = async (interaction, _client) => {
    const code = normalizeReferralCode(interaction.options.getString("code", true));
    if (!code) return void await interaction.editReply({ content: BAD_CODE() });

    const bonus = bonusOption(interaction);
    if (bonus === null) return void await interaction.editReply({ content: L(`The bonus must be between 0% and ${MAX}.`, `الزيادة لازم تكون بين 0% و ${MAX}.`) });

    const active = interaction.options.getBoolean("active");
    const owner = interaction.options.getUser("owner");
    const changes = {
        ...(active !== null ? { active } : {}),
        ...(bonus !== undefined ? { bonusBp: bonus } : {}),
        ...(owner ? { ownerId: owner.id } : {}),
    };
    if (!Object.keys(changes).length) return void await interaction.editReply({ content: L("Nothing to change: set `active`, `bonus` or `owner`.", "ما في شي يتغير: حدد `active` أو `bonus` أو `owner`.") });

    const updated = await ReferralCodeRepository.update(interaction.guildId!, code, changes);
    await interaction.editReply({
        content: updated
            ? L(`**${code}** — ${updated.active ? "active" : "inactive"}, **+${formatReferralPercent(updated.bonusBp)}**, owner <@${updated.ownerId}>. Members' next rewards use this.`, `**${code}** — ${updated.active ? "فعال" : "غير فعال"}، **+${formatReferralPercent(updated.bonusBp)}**، المالك <@${updated.ownerId}>. المكافآت الجاية تستخدم هذا.`)
            : L(`No code named **${code}**.`, `ما في كود اسمه **${code}**.`),
        allowedMentions: { parse: [] },
    });
};

export const remove: FeatureSubcommandHandler = async (interaction, _client) => {
    const code = normalizeReferralCode(interaction.options.getString("code", true));
    const deleted = code ? await ReferralCodeRepository.delete(interaction.guildId!, code) : null;

    await interaction.editReply({
        content: deleted
            ? L(`Deleted **${deleted.code}**. Its members now get +0% and may apply another code.`, `تم حذف **${deleted.code}**. أعضاؤه صار لهم +0% ويقدرون يستخدمون كود ثاني.`)
            : L("No such code.", "ما في كود بهذا الاسم."),
    });
};

export const list: FeatureSubcommandHandler = async (interaction, _client) => {
    const codes = await ReferralCodeRepository.list(interaction.guildId!);
    if (!codes.length) return void await interaction.editReply({ content: L("No referral codes yet. Create one with `/referral-config create`.", "ما في أكواد إحالة لين الحين. أنشئ واحد بـ `/referral-config create`.") });

    const counts = await Promise.all(codes.map(c => ReferralCodeUseRepository.countByCode(String(c._id))));
    const lines = codes.map((c, i) =>
        L(`**${c.code}** · <@${c.ownerId}> · +${formatReferralPercent(c.bonusBp)} · ${c.active ? "active" : "inactive"} · ${counts[i]} member${counts[i] === 1 ? "" : "s"}`, `**${c.code}** · <@${c.ownerId}> · +${formatReferralPercent(c.bonusBp)} · ${c.active ? "فعال" : "غير فعال"} · ${counts[i]} عضو`));

    await interaction.editReply({ content: lines.join("\n").slice(0, 2000), allowedMentions: { parse: [] } });
};

export const reset: FeatureSubcommandHandler = async (interaction, _client) => {
    const user = interaction.options.getUser("user", true);
    const cleared = await ReferralCodeUseRepository.clear(interaction.guildId!, user.id);

    await interaction.editReply({
        content: cleared ? L(`<@${user.id}> no longer uses a referral code and may apply another.`, `<@${user.id}> ما عاد يستخدم كود إحالة ويقدر يستخدم كود ثاني.`) : L(`<@${user.id}> doesn't use a referral code.`, `<@${user.id}> ما يستخدم كود إحالة.`),
        allowedMentions: { parse: [] },
    });
};
