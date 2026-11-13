import type { FeatureComponentIndex } from "@typings/feature";
import { topPageHandler } from "./components/page-nav";

export default {
    feature: "top",
    handlers: [topPageHandler],
} satisfies FeatureComponentIndex;
