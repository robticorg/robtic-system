import type { AdminLogsConfig, GuildChannelInfo } from "../../../types/admin";
import { useSectionEditor } from "../../../hooks/use-section-editor";
import { channelOptions } from "../../../utils/to-options";
import { LOG_LABELS } from "../../../utils/log-registry";
import { SectionShell } from "../section-shell";
import { EntitySelect } from "../entity-select";

interface Props {
    initial: AdminLogsConfig;
    channels: GuildChannelInfo[];
}

export function LogsSection({ initial, channels }: Props) {
    const { draft, setDraft, dirty, status, commit } = useSectionEditor("logs", initial);
    const chOpts = channelOptions(channels);

    const keys = Object.keys(draft.channels).sort((a, b) => (LOG_LABELS[a] ?? a).localeCompare(LOG_LABELS[b] ?? b));

    return (
        <SectionShell
            title="Log Channels"
            icon="hash"
            description="Route each log stream to a channel. Leave one as None to disable it."
            status={status}
            dirty={dirty}
            onSave={commit}
        >
            {keys.map((key) => (
                <EntitySelect
                    key={key}
                    label={LOG_LABELS[key] ?? key}
                    value={draft.channels[key] ?? null}
                    options={chOpts}
                    onChange={(v) => setDraft({ ...draft, channels: { ...draft.channels, [key]: v } })}
                />
            ))}
        </SectionShell>
    );
}
