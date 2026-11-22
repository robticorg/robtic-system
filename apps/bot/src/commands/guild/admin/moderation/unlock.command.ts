import { STAFF_TIER_THRESHOLDS } from "@constants";
import { channelTool } from "./channel-tool";

export default {
    ...channelTool("unlock", "Unlock a channel so members can send messages again."),
    requiredPermission: STAFF_TIER_THRESHOLDS.staff,
};
