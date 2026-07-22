import type { AdminBootstrap } from "../types/admin";
import { ServerSection } from "../components/admin/sections/server-section";
import { XpSection } from "../components/admin/sections/xp-section";
import { StreakSection } from "../components/admin/sections/streak-section";
import { ComboSection } from "../components/admin/sections/combo-section";
import { PunishSection } from "../components/admin/sections/punish-section";
import { LogsSection } from "../components/admin/sections/logs-section";

/** The admin config panel. Only rendered once the bootstrap has confirmed the viewer is an admin. */
export function AdminView({ data }: { data: AdminBootstrap }) {
    if (!data.config || !data.channels || !data.roles) {
        return <p className="muted">Configuration is unavailable right now.</p>;
    }

    const { config, channels, roles } = data;

    return (
        <div className="admin">
            <p className="muted" style={{ marginTop: 0 }}>
                Changes apply immediately across all bots in this server.
            </p>

            <ServerSection initial={config.server} channels={channels} roles={roles} />
            <XpSection initial={config.xp} channels={channels} roles={roles} />
            <StreakSection initial={config.streak} channels={channels} />
            <ComboSection initial={config.combo} roles={roles} />
            <PunishSection initial={config.punish} channels={channels} roles={roles} />
            <LogsSection initial={config.logs} channels={channels} />
        </div>
    );
}
