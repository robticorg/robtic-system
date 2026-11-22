import { STAFF_TIER_THRESHOLDS } from "@constants";
import { channelTool } from "./channel-tool";

export default {
    ...channelTool("unhide", "Make a hidden channel visible again."),
    requiredPermission: STAFF_TIER_THRESHOLDS.staff,
};
