import type { FeatureComponentIndex } from "@typings/feature";
import { invitesInfoPageHandler } from "./components/info-page";

export default {
    feature: "invites",
    handlers: [invitesInfoPageHandler],
} satisfies FeatureComponentIndex;
