import type { FeatureComponentIndex } from "@typings/feature";
import { musicCreateModalHandler } from "./components/create-modal";

export default {
    feature: "music",
    handlers: [musicCreateModalHandler],
} satisfies FeatureComponentIndex;
