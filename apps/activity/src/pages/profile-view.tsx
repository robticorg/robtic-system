import { useEffect, useState } from "react";
import type { Profile } from "../types/profile";
import { fetchOwnProfile, fetchProfile } from "../services/api/api-client";
import { ProfileHeader } from "../components/profile-header";
import { XpCard } from "../components/xp-card";
import { StreakCard } from "../components/streak-card";
import { ComboCard } from "../components/combo-card";
import { Icon } from "../components/icon";
import { formatNumber } from "../utils/format";

interface ProfileViewProps {
    /** Null renders the signed-in user's own profile. */
    userId: string | null;
    onBack: (() => void) | null;
}

export function ProfileView({ userId, onBack }: ProfileViewProps) {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setProfile(null);
        setError(null);

        const load = userId ? fetchProfile(userId) : fetchOwnProfile();
        load
            .then((result) => { if (!cancelled) setProfile(result); })
            .catch((err: unknown) => {
                if (!cancelled) setError(err instanceof Error ? err.message : String(err));
            });

        return () => { cancelled = true; };
    }, [userId]);

    if (error) return <p className="error">{error}</p>;
    if (!profile) return <div className="spinner" aria-label="Loading profile" />;

    return (
        <>
            {onBack && (
                <button type="button" className="back-button" onClick={onBack}>
                    <Icon name="chevron-left" size={16} /> Back
                </button>
            )}

            <ProfileHeader profile={profile} />

            <div className="stat-grid">
                <div className="stat stat--xp">
                    <span className="stat__label"><Icon name="activity" size={14} /> Messages</span>
                    <div className="stat__value">{formatNumber(profile.xp.messageCount)}</div>
                </div>
                <div className="stat stat--streak">
                    <span className="stat__label"><Icon name="fire" size={14} /> Streak</span>
                    <div className="stat__value">{profile.streak.current}</div>
                    <div className="stat__meta">best {profile.streak.best}</div>
                </div>
                <div className="stat stat--combo">
                    <span className="stat__label"><Icon name="message" size={14} /> Best combo</span>
                    <div className="stat__value">{formatNumber(profile.combo.bestScore)}</div>
                </div>
            </div>

            <div style={{ marginTop: 12 }}>
                <XpCard xp={profile.xp} />
                <StreakCard streak={profile.streak} />
                <ComboCard combo={profile.combo} partners={profile.partners} />
            </div>
        </>
    );
}
