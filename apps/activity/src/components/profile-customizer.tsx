import { useState } from "react";
import type { Profile, ProfileCustomization } from "../types/profile";
import { saveProfileCustomization } from "../services/api/api-client";
import { Icon } from "./icon";

const COLOR_PRESETS = ["#2b93ff", "#3ddc84", "#ff9142", "#9b8cff", "#ff4d5e", "#f5c518", "#00c2b2", "#e75fb3"];
const TEXT_PRESETS = ["#e8ecf3", "#ffffff", "#ffd9a0", "#c9f0ff", "#d6ffe1", "#f0d6ff"];

export const TEMPLATES: { id: string; label: string }[] = [
    { id: "classic", label: "Classic" },
    { id: "banner", label: "Banner" },
    { id: "compact", label: "Compact" },
    { id: "card", label: "Card" },
    { id: "minimal", label: "Minimal" },
];

interface ColorFieldProps {
    label: string;
    hint: string;
    value: string;
    presets: string[];
    fallbackHex: string;
    onChange: (value: string) => void;
}

/** Unlimited color choice: native picker + free hex input + a few quick presets + clear. */
function ColorField({ label, hint, value, presets, fallbackHex, onChange }: ColorFieldProps) {
    return (
        <div className="field">
            <span className="field__label">{label} <span className="field__hint">{hint}</span></span>
            <div className="customizer__swatches">
                <input
                    type="color"
                    className="color-pick"
                    value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : fallbackHex}
                    title="Pick any color"
                    onChange={(event) => onChange(event.target.value)}
                />
                <input
                    className="field__input customizer__hex"
                    value={value}
                    maxLength={7}
                    placeholder={fallbackHex}
                    onChange={(event) => onChange(event.target.value)}
                />
                {presets.map((preset) => (
                    <button
                        key={preset}
                        type="button"
                        className={`swatch${value === preset ? " swatch--active" : ""}`}
                        style={{ background: preset }}
                        title={preset}
                        onClick={() => onChange(preset)}
                    />
                ))}
                <button
                    type="button"
                    className={`swatch swatch--none${value === "" ? " swatch--active" : ""}`}
                    title="Default"
                    onClick={() => onChange("")}
                >
                    <Icon name="x" size={12} />
                </button>
            </div>
        </div>
    );
}

interface ProfileCustomizerProps {
    profile: Profile;
    /** Called on every edit so the page previews the look before it's accepted. */
    onPreview: (draft: Partial<ProfileCustomization>) => void;
    onCancel: () => void;
    onSaved: () => void;
}

/** Self-service profile look editor. Edits preview live; nothing persists until Save. */
export function ProfileCustomizer({ profile, onPreview, onCancel, onSaved }: ProfileCustomizerProps) {
    const [color, setColor] = useState(profile.customization.color ?? "");
    const [textColor, setTextColor] = useState(profile.customization.textColor ?? "");
    const [bannerUrl, setBannerUrl] = useState(profile.customization.bannerUrl ?? "");
    const [bio, setBio] = useState(profile.customization.bio ?? "");
    const [template, setTemplate] = useState(profile.customization.template ?? "classic");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function preview(next: Partial<{ color: string; textColor: string; bannerUrl: string; bio: string; template: string }>) {
        const merged = { color, textColor, bannerUrl, bio, template, ...next };
        if (next.color !== undefined) setColor(next.color);
        if (next.textColor !== undefined) setTextColor(next.textColor);
        if (next.bannerUrl !== undefined) setBannerUrl(next.bannerUrl);
        if (next.bio !== undefined) setBio(next.bio);
        if (next.template !== undefined) setTemplate(next.template);
        onPreview({
            color: merged.color || null,
            textColor: merged.textColor || null,
            bannerUrl: merged.bannerUrl || null,
            bio: merged.bio || null,
            template: merged.template,
        });
    }

    async function save() {
        setSaving(true);
        setError(null);
        try {
            await saveProfileCustomization({
                profileColor: color,
                textColor,
                bannerUrl,
                bio,
                template,
            });
            onSaved();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setSaving(false);
        }
    }

    return (
        <div className="card customizer">
            <h2 className="card__title"><Icon name="palette" size={15} /> Customize your profile</h2>
            <p className="muted" style={{ margin: "0 0 12px" }}>
                Changes preview live below — nothing is saved until you accept.
            </p>

            <ColorField
                label="Profile color"
                hint="tints your entire profile — backgrounds, borders and accents"
                value={color}
                presets={COLOR_PRESETS}
                fallbackHex="#2b93ff"
                onChange={(v) => preview({ color: v })}
            />

            <div style={{ marginTop: 12 }}>
                <ColorField
                    label="Text color"
                    hint="any color you like — keep it readable on your profile color"
                    value={textColor}
                    presets={TEXT_PRESETS}
                    fallbackHex="#e8ecf3"
                    onChange={(v) => preview({ textColor: v })}
                />
            </div>

            <div className="field" style={{ marginTop: 12 }}>
                <span className="field__label"><Icon name="image" size={13} /> Banner image URL <span className="field__hint">also shown on !profile — empty removes it</span></span>
                <input
                    className="field__input"
                    value={bannerUrl}
                    placeholder="https://…/banner.png"
                    onChange={(event) => preview({ bannerUrl: event.target.value })}
                />
            </div>

            <div className="field" style={{ marginTop: 12 }}>
                <span className="field__label">Bio <span className="field__hint">max 190 characters</span></span>
                <textarea
                    className="field__input projects__textarea"
                    value={bio}
                    maxLength={190}
                    rows={3}
                    placeholder="Tell the server something about you"
                    onChange={(event) => preview({ bio: event.target.value })}
                />
            </div>

            <div className="field" style={{ marginTop: 12 }}>
                <span className="field__label">Profile template <span className="field__hint">restyles the whole page — try each one</span></span>
                <div className="customizer__templates">
                    {TEMPLATES.map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            className="template-option"
                            aria-pressed={template === option.id}
                            onClick={() => preview({ template: option.id })}
                        >
                            <span className={`template-thumb template-thumb--${option.id}`}>
                                <span className="template-thumb__banner" />
                                <span className="template-thumb__avatar" />
                                <span className="template-thumb__line" />
                                <span className="template-thumb__line template-thumb__line--short" />
                            </span>
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="mod__run">
                {error && <span className="mod__status mod__status--err"><Icon name="alert" size={14} /> {error}</span>}
                <div className="customizer__actions">
                    <button type="button" className="ghost-button" disabled={saving} onClick={onCancel}>
                        Cancel
                    </button>
                    <button type="button" className="run-button" disabled={saving} onClick={save}>
                        <Icon name="check" size={15} /> {saving ? "Saving…" : "Accept look"}
                    </button>
                </div>
            </div>
        </div>
    );
}
