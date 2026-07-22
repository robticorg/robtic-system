interface Option {
    id: string;
    name: string;
}

interface EntitySelectProps {
    label: string;
    hint?: string;
    value: string | null;
    options: Option[];
    placeholder?: string;
    onChange: (value: string | null) => void;
}

/** Single-choice dropdown for one channel or role, with a "None" option. */
export function EntitySelect({ label, hint, value, options, placeholder, onChange }: EntitySelectProps) {
    return (
        <label className="field">
            <span className="field__label">{label}</span>
            {hint && <span className="field__hint">{hint}</span>}
            <select
                className="field__select"
                value={value ?? ""}
                onChange={(e) => onChange(e.target.value || null)}
            >
                <option value="">{placeholder ?? "None"}</option>
                {options.map((option) => (
                    <option key={option.id} value={option.id}>{option.name}</option>
                ))}
            </select>
        </label>
    );
}
