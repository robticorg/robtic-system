interface NumberFieldProps {
    label: string;
    hint?: string;
    value: number;
    min?: number;
    max?: number;
    onChange: (value: number) => void;
}

export function NumberField({ label, hint, value, min, max, onChange }: NumberFieldProps) {
    return (
        <label className="field">
            <span className="field__label">{label}</span>
            {hint && <span className="field__hint">{hint}</span>}
            <input
                className="field__input"
                type="number"
                value={Number.isFinite(value) ? value : 0}
                min={min}
                max={max}
                onChange={(e) => onChange(Number(e.target.value))}
            />
        </label>
    );
}
