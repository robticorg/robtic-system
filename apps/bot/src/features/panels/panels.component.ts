import type { FeatureComponentIndex } from "@typings/feature";
import { panelViewHandler } from "./components/panel-view";
import { activitySystemSelectHandler } from "./components/activity-system-select";
import { guildPanelHandler } from "./components/guild-panel";

export default {
    feature: "panels",
    handlers: [panelViewHandler, activitySystemSelectHandler, guildPanelHandler],
} satisfies FeatureComponentIndex;
