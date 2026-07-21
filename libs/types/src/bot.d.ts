type BotName = "main" | "moderation" | "hr" | "modmail" | "community" | "dev";
type StatusType = "STARTING" | "HEALTHY" | "DEGRADED" | "OFFLINE"

type BotTokenKey =
    | "MainBotToken"
    | "ModerationBotToken"
    | "HRBotToken"
    | "ModeMailBotToken"
    | "CommunityBotToken"
    | "DevBotToken"
    | "TestBot"


interface BotDefinition<Gateway, Partials> {
    name: BotName;
    tokenKey: BotTokenKey;
    intents: Gateway[];
    partials?: Partials[];
    description: string;
}

interface BotStatus {
    name: BotName;
    online?: boolean;
    status?: StatusType;
    message?: string;
    uptime?: number | null;
    guilds?: number;
    ping?: number;
    modulesLoaded?: string[];
}

interface ModuleDefinition {
    name: string;
    description: string;
    commandsDir: string;
    eventsDir?: string;
    componentsDir?: string;
    onLoad?: () => Promise<void>;
    onUnload?: () => Promise<void>;
}

/**
 * Both used to be fixed unions (one Department/PermissionLevel set for every server). Now that
 * staff tiers/departments are per-guild data (see StaffTier model), these are free-form guild-defined
 * strings — kept as named type aliases purely for readability at call sites, not for compile-time
 * enumeration. The old fixed value sets (Dev/Design/Moderation/... and Owner/LeadDev/DevManager/...)
 * still exist as real string values, they're just no longer statically enforced.
 */
type Department = string;
type PermissionLevel = string;
