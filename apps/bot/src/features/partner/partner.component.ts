import type { FeatureComponentIndex } from "@typings/feature";
import { partnerAddModalHandler } from "./components/add-modal";
import { partnerEditModalHandler } from "./components/edit-modal";
import { partnerInfoHandler } from "./components/info-button";

export default {
    feature: "partner",
    handlers: [partnerAddModalHandler, partnerEditModalHandler, partnerInfoHandler],
} satisfies FeatureComponentIndex;
