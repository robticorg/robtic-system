import type { AdminPunishConfig, GuildChannelInfo, GuildRoleInfo } from "../../../types/admin";
import { useSectionEditor } from "../../../hooks/use-section-editor";
import { channelOptions, roleOptions } from "../../../utils/to-options";
import { SectionShell } from "../section-shell";
import { EntitySelect } from "../entity-select";
import { EntityMultiSelect } from "../entity-multi-select";
import { NumberField } from "../number-field";

interface Props {
    initial: AdminPunishConfig;
    channels: GuildChannelInfo[];
    roles: GuildRoleInfo[];
}

export function PunishSection({ initial, channels, roles }: Props) {
    const { draft, setDraft, dirty, status, commit } = useSectionEditor("punish", initial);

    return (
        <SectionShell
            title="Moderation"
            icon="shield"
            description="Moderator points per action, the proof channel, and punishment-shortcut roles."
            status={status}
            dirty={dirty}
            onSave={commit}
        >
            <NumberField
                label="Points per action"
                hint="Moderator points awarded per warn/mute."
                value={draft.pointsPerAction}
                min={0}
                max={1000}
                onChange={(v) => setDraft({ ...draft, pointsPerAction: v })}
            />
            <EntitySelect
                label="Proof channel"
                hint="Where submitted punishment evidence is posted."
                value={draft.proofChannelId}
                options={channelOptions(channels)}
                onChange={(v) => setDraft({ ...draft, proofChannelId: v })}
            />
            <EntityMultiSelect
                label="Shortcut roles"
                hint="Roles allowed to use punishment shortcuts."
                selected={draft.shortcutRoleIds}
                options={roleOptions(roles)}
                onChange={(ids) => setDraft({ ...draft, shortcutRoleIds: ids })}
            />
        </SectionShell>
    );
}
