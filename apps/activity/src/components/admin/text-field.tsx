interface TextFieldProps {
    label: string;
    hint?: string;
    value: string;
    placeholder?: string;
    maxLength?: number;
    onChange: (value: string) => void;
}

export function TextField({ label, hint, value, placeholder, maxLength, onChange }: TextFieldProps) {
    return (
        <label className="field">
            <span className="field__label">{label}</span>
            {hint && <span className="field__hint">{hint}</span>}
            <input
                className="field__input"
                type="text"
                value={value}
                placeholder={placeholder}
                maxLength={maxLength}
                onChange={(e) => onChange(e.target.value)}
            />
        </label>
    );
}
