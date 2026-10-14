import { COMPETITION_COMMANDS } from "./instance";
import { getCompetitionBot } from "./runtime";

/**
 * TEMP — both bots use `!`, and the main bot has its own `!check`. While a server has a competition
 * bot running, the main bot leaves the competition's commands to it.
 */
export function isCompetitionCommand(guildId: string, commandName: string): boolean {
    return COMPETITION_COMMANDS.has(commandName.toLowerCase()) && Boolean(getCompetitionBot(guildId)?.online);
}
