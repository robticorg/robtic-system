import type { FeatureComponentIndex } from "@typings/feature";
import { partnerAddModalHandler } from "./components/add-modal";
import { partnerInfoHandler } from "./components/info-button";

export default {
    feature: "partner",
    handlers: [partnerAddModalHandler, partnerInfoHandler],
} satisfies FeatureComponentIndex;
