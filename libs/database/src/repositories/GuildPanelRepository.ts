import { GuildPanel, type IGuildPanel } from "@database/models/GuildPanel";

const TTL_MS = 30_000;
const cache = new Map<string, { panel: IGuildPanel | null; at: number }>();

export class GuildPanelRepository {
    /** Read on every click, so cached briefly; the dashboard's edits show within half a minute. */
    static async get(guildId: string, panelId: string): Promise<IGuildPanel | null> {
        const key = `${guildId}:${panelId}`;
        const hit = cache.get(key);
        if (hit && Date.now() - hit.at < TTL_MS) return hit.panel;
        const panel = await GuildPanel.findOne({ guildId, panelId });
        cache.set(key, { panel, at: Date.now() });
        return panel;
    }

    static invalidate(guildId: string, panelId: string): void {
        cache.delete(`${guildId}:${panelId}`);
    }
}
