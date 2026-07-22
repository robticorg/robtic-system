interface ToggleFieldProps {
    label: string;
    hint?: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}

export function ToggleField({ label, hint, checked, onChange }: ToggleFieldProps) {
    return (
        <div className="field field--row">
            <div>
                <span className="field__label">{label}</span>
                {hint && <span className="field__hint">{hint}</span>}
            </div>
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                className={`switch${checked ? " switch--on" : ""}`}
                onClick={() => onChange(!checked)}
            >
                <span className="switch__dot" />
            </button>
        </div>
    );
}
