import type { AdminComboConfig, GuildRoleInfo } from "../../../types/admin";
import { useSectionEditor } from "../../../hooks/use-section-editor";
import { roleOptions } from "../../../utils/to-options";
import { SectionShell } from "../section-shell";
import { EntitySelect } from "../entity-select";
import { ToggleField } from "../toggle-field";
import { NumberField } from "../number-field";

interface Props {
    initial: AdminComboConfig;
    roles: GuildRoleInfo[];
}

const DEFAULT_MIN = 2;
const DEFAULT_MAX = 7;

export function ComboSection({ initial, roles }: Props) {
    const { draft, setDraft, dirty, status, commit } = useSectionEditor("combo", initial);

    const overrideRange = draft.minScorePerMessage != null && draft.maxScorePerMessage != null;

    function toggleOverride(on: boolean) {
        setDraft(on
            ? { ...draft, minScorePerMessage: draft.minScorePerMessage ?? DEFAULT_MIN, maxScorePerMessage: draft.maxScorePerMessage ?? DEFAULT_MAX }
            : { ...draft, minScorePerMessage: null, maxScorePerMessage: null });
    }

    return (
        <SectionShell
            title="Combo"
            icon="message"
            description="Champion role and, optionally, a custom per-message score range."
            status={status}
            dirty={dirty}
            onSave={commit}
        >
            <EntitySelect
                label="Champion role"
                hint="Granted to the member with the highest all-time combo."
                value={draft.championRoleId}
                options={roleOptions(roles)}
                onChange={(v) => setDraft({ ...draft, championRoleId: v })}
            />
            <ToggleField
                label="Custom score range"
                hint="Override the default per-message score range."
                checked={overrideRange}
                onChange={toggleOverride}
            />
            {overrideRange && (
                <>
                    <NumberField
                        label="Minimum score per message"
                        value={draft.minScorePerMessage ?? DEFAULT_MIN}
                        min={1}
                        max={100}
                        onChange={(v) => setDraft({ ...draft, minScorePerMessage: v })}
                    />
                    <NumberField
                        label="Maximum score per message"
                        value={draft.maxScorePerMessage ?? DEFAULT_MAX}
                        min={1}
                        max={100}
                        onChange={(v) => setDraft({ ...draft, maxScorePerMessage: v })}
                    />
                </>
            )}
        </SectionShell>
    );
}
