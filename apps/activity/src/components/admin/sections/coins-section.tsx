import type { AdminCoinsConfig } from "../../../types/admin";
import { useSectionEditor } from "../../../hooks/use-section-editor";
import { SectionShell } from "../section-shell";
import { NumberField } from "../number-field";
import { Icon } from "../../icon";

export function CoinsSection({ initial }: { initial: AdminCoinsConfig }) {
    const { draft, setDraft, dirty, status, commit } = useSectionEditor("coins", initial);

    function setReward(index: number, key: "streak" | "coins", value: number) {
        const rewards = draft.streakRewards.map((row, i) => i === index ? { ...row, [key]: value } : row);
        setDraft({ ...draft, streakRewards: rewards });
    }

    function addReward() {
        setDraft({ ...draft, streakRewards: [...draft.streakRewards, { streak: 5, coins: 1 }] });
    }

    function removeReward(index: number) {
        setDraft({ ...draft, streakRewards: draft.streakRewards.filter((_, i) => i !== index) });
    }

    return (
        <SectionShell
            title="Coins"
            icon="coin"
            description="Earning rates for the coin economy: messages, combo score and streak payouts."
            status={status}
            dirty={dirty}
            onSave={commit}
        >
            <NumberField
                label="Messages per coin"
                hint="Real messages a member must send to earn 1 coin."
                value={draft.messagesPerCoin}
                min={10}
                max={100000}
                onChange={(v) => setDraft({ ...draft, messagesPerCoin: v })}
            />
            <NumberField
                label="Combo score per coin"
                hint="Combo score a member must earn to gain 1 coin."
                value={draft.comboPerCoin}
                min={10}
                max={100000}
                onChange={(v) => setDraft({ ...draft, comboPerCoin: v })}
            />

            <div className="field">
                <span className="field__label">
                    Streak payouts
                    <span className="field__hint">reaching each day-count pays the listed coins (e.g. 5 days → 1 coin)</span>
                </span>

                {draft.streakRewards.length === 0 && (
                    <p className="muted" style={{ margin: 0 }}>No streak payouts configured.</p>
                )}

                {draft.streakRewards.map((row, index) => (
                    <div key={index} className="reward-row">
                        <label className="reward-row__field">
                            <span>Streak days</span>
                            <input
                                className="field__input"
                                type="number"
                                min={1}
                                value={row.streak}
                                onChange={(event) => setReward(index, "streak", Number(event.target.value))}
                            />
                        </label>
                        <span className="reward-row__arrow">→</span>
                        <label className="reward-row__field">
                            <span>Coins</span>
                            <input
                                className="field__input"
                                type="number"
                                min={1}
                                value={row.coins}
                                onChange={(event) => setReward(index, "coins", Number(event.target.value))}
                            />
                        </label>
                        <button
                            type="button"
                            className="reward-row__remove"
                            aria-label="Remove payout"
                            onClick={() => removeReward(index)}
                        >
                            <Icon name="x" size={14} />
                        </button>
                    </div>
                ))}

                <button type="button" className="ghost-button" style={{ alignSelf: "flex-start" }} onClick={addReward}>
                    <Icon name="plus" size={13} style={{ verticalAlign: "-2px" }} /> Add payout
                </button>
            </div>
        </SectionShell>
    );
}
