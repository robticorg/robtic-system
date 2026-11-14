import type { FeatureComponentIndex } from "@typings/feature";
import { musicPanelButtonHandler, musicPanelModalHandler } from "./components/panel";

export default {
    feature: "music",
    handlers: [musicPanelButtonHandler, musicPanelModalHandler],
} satisfies FeatureComponentIndex;
