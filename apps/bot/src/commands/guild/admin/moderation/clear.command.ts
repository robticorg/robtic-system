import { STAFF_TIER_THRESHOLDS } from "@constants";
import { channelTool } from "./channel-tool";

/** /clear [amount] [channel]. Shortcuts (`c 10`, `c X`, `c ١٠`) also take Arabic digits and Roman numerals. */
export default {
    ...channelTool("clear", "Delete recent messages in a channel.", b => {
        b.addIntegerOption(opt =>
            opt.setName("amount")
                .setDescription("How many messages to delete (1 to 100). Default 100.")
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(false));
    }),
    requiredPermission: STAFF_TIER_THRESHOLDS.staff,
};
