import { useEffect, useState } from "react";
import type { Profile } from "../types/profile";
import { fetchOwnProfile } from "../services/api/api-client";
import { Logo } from "../components/logo";
import { Avatar } from "../components/avatar";
import { Icon } from "../components/icon";
import { formatNumber, formatRank } from "../utils/format";

interface LandingProps {
    userName: string;
    avatarUrl: string | null;
    userId: string;
}

/** The Activity's opening screen — brand hero and a personal snapshot. Navigation lives in the avatar menu. */
export function Landing({ userName, avatarUrl, userId }: LandingProps) {
    const [profile, setProfile] = useState<Profile | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetchOwnProfile()
            .then((result) => { if (!cancelled) setProfile(result); })
            .catch(() => null); // The hero stats are a bonus — the landing works without them.
        return () => { cancelled = true; };
    }, []);

    return (
        <div className="landing">
            <div className="landing__hero">
                <div className="landing__logo"><Logo size={72} /></div>
                <h1 className="landing__title">Robtic Hub</h1>
                <p className="landing__subtitle">Your server profile, leaderboards and projects — all in one place.</p>

                <div className="landing__greeting">
                    <Avatar src={avatarUrl} name={userName} seed={userId} size={34} />
                    <span>Welcome back, <b>{userName}</b></span>
                </div>

                {profile && (
                    <div className="landing__stats">
                        <div className="landing-stat">
                            <Icon name="zap" size={15} />
                            <b>Lv {profile.xp.level}</b>
                            <span>{formatRank(profile.xp.rank)}</span>
                        </div>
                        <div className="landing-stat landing-stat--streak">
                            <Icon name="fire" size={15} />
                            <b>{profile.streak.current}</b>
                            <span>streak</span>
                        </div>
                        <div className="landing-stat landing-stat--combo">
                            <Icon name="message" size={15} />
                            <b>{formatNumber(profile.combo.bestScore)}</b>
                            <span>best combo</span>
                        </div>
                        <div className="landing-stat landing-stat--coins">
                            <Icon name="coin" size={15} />
                            <b>{formatNumber(profile.coins)}</b>
                            <span>coins</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
