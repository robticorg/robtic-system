import { defineFeature } from "@typings/feature";
import { REWARD_REFERRAL_BONUS } from "@constants";

const MAX_PERCENT = REWARD_REFERRAL_BONUS.maxBp / 100;
const CODE_OPTION = { name: "code", description: "The referral code", type: "string", required: true } as const;
const BONUS_OPTION = { name: "bonus", description: `Reward bonus in %, up to ${MAX_PERCENT}`, type: "number", minValue: 0, maxValue: MAX_PERCENT } as const;

/**
 * Referral codes: staff create codes for partners/creators (`/referral-config`), members apply one
 * (`/referral use`), and while that code is active it adds its configured bonus to every reward the
 * member claims — resolved live by `resolveRewardBonuses`, never stored on the member.
 *
 * `default-on` because nothing happens until staff create a code.
 */
export const referralFeature = defineFeature({
    key: "referral",
    description: "Referral codes: /referral use|info, /referral-config for staff",
    activation: "default-on",
    commands: [
        {
            name: "referral",
            description: "Use a referral code for a reward bonus",
            scope: "guild",
            access: "general",
            category: "Activity",
            subcommands: [
                { name: "use", description: "Apply a referral code (one per member)", options: [CODE_OPTION] },
                { name: "info", description: "Your referral code and the bonus it gives you now" },
            ],
        },
        {
            name: "referral-config",
            description: "Manage referral codes",
            scope: "guild",
            access: "admin",
            category: "Configuration",
            subcommands: [
                {
                    name: "create",
                    description: "Create a referral code for a partner or creator",
                    options: [
                        CODE_OPTION,
                        { name: "owner", description: "Who the code belongs to", type: "user", required: true },
                        BONUS_OPTION,
                    ],
                },
                {
                    name: "edit",
                    description: "Turn a code on/off, or change its bonus or owner",
                    options: [
                        CODE_OPTION,
                        { name: "active", description: "Whether the code gives its bonus", type: "boolean" },
                        BONUS_OPTION,
                        { name: "owner", description: "New owner", type: "user" },
                    ],
                },
                { name: "delete", description: "Delete a code — its members' bonus becomes +0%", options: [CODE_OPTION] },
                { name: "list", description: "Every referral code" },
                {
                    name: "reset",
                    description: "Remove a member's referral code so they can apply another",
                    options: [{ name: "user", description: "The member", type: "user", required: true }],
                },
            ],
        },
    ],
});
