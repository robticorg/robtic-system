import type { ADMIN_CONFIG_SECTIONS } from "@constants/admin-config";

/** Which bot subsystem a config write targets. Derived from the constant so the two cannot drift. */
export type AdminConfigSection = typeof ADMIN_CONFIG_SECTIONS[number];
