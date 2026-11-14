import type { FeatureComponentIndex } from "@typings/feature";
import { musicPanelButtonHandler, musicPanelMenuHandler, musicPanelModalHandler } from "./components/panel";

export default {
    feature: "music",
    handlers: [musicPanelButtonHandler, musicPanelMenuHandler, musicPanelModalHandler],
} satisfies FeatureComponentIndex;
