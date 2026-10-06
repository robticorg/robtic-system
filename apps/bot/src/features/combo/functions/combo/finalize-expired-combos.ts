import type { Guild } from "discord.js";
import type { ICombo } from "@database/models";
import { ComboRepository } from "@database/repositories";
import { finalizeCombo, isStale } from "@core/combo";

export async function finalizeExpiredCombos(guild: Guild): Promise<ICombo[]> {
    const now = Date.now();
    const active = await ComboRepository.findAllActive(guild.id);
    const stillActive: ICombo[] = [];

    for (const pair of active) {
        if (isStale(pair, now)) {
            await finalizeCombo(pair);
        } else {
            stillActive.push(pair);
        }
    }

    return stillActive;
}
