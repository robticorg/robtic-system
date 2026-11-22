import { STAFF_TIER_THRESHOLDS } from "@constants";
import { channelTool } from "./channel-tool";

export default {
    ...channelTool("lock", "Lock a channel so members can't send messages."),
    requiredPermission: STAFF_TIER_THRESHOLDS.staff,
};
