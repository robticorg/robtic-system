import { STAFF_TIER_THRESHOLDS } from "@constants";
import { channelTool } from "./channel-tool";

export default {
    ...channelTool("hide", "Hide a channel so members can't see it."),
    requiredPermission: STAFF_TIER_THRESHOLDS.staff,
};
