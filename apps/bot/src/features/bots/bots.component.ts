import type { FeatureComponentIndex } from "@typings/feature";
import { botCreateModalHandler } from "./components/create-modal";
import { botDeleteModalHandler } from "./components/delete-modal";

export default {
    feature: "bots",
    handlers: [botCreateModalHandler, botDeleteModalHandler],
} satisfies FeatureComponentIndex;
