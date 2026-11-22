import { STAFF_TIER_THRESHOLDS } from "@constants";
import { channelTool } from "./channel-tool";

export default {
    ...channelTool("slowmode", "Set a channel's slowmode.", b => {
        b.addStringOption(opt =>
            opt.setName("duration")
                .setDescription("5s, 1m, 2h, or 0 to turn it off")
                .setRequired(true));
    }),
    requiredPermission: STAFF_TIER_THRESHOLDS.staff,
};
