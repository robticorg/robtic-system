import { PROJECT_TYPE_OPTIONS } from "@constants";

export type ProjectKind = typeof PROJECT_TYPE_OPTIONS[number];

/** Normalizes a legacy/free-form project type onto one of PROJECT_TYPE_OPTIONS. */
export function normalizeProjectType(raw: string): ProjectKind {
    const lowered = raw.toLowerCase();
    if (lowered.startsWith("w")) return "web";
    if (lowered.startsWith("d")) return "discord";
    if ((PROJECT_TYPE_OPTIONS as readonly string[]).includes(lowered)) return lowered as ProjectKind;
    return "other";
}
