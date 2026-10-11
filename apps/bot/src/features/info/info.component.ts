import type { FeatureComponentIndex } from "@typings/feature";
import {
    infoButtonHandler,
    infoCreateModalHandler,
    infoMenuHandler,
    infoOptionModalHandler,
    infoUpdateModalHandler,
} from "./components/handlers";

export default {
    feature: "info",
    handlers: [infoCreateModalHandler, infoUpdateModalHandler, infoOptionModalHandler, infoButtonHandler, infoMenuHandler],
} satisfies FeatureComponentIndex;
