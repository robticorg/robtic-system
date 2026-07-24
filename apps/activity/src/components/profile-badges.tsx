import type { ProfileBadge } from "../types/profile";

/**
 * Small achievement badges next to the profile name: the streak fire tier renders its
 * matching /badges/fire<min>-<max>.png image; server-#1 achievements render crown chips.
 */
export function ProfileBadges({ badges }: { badges: ProfileBadge[] }) {
    if (badges.length === 0) return null;

    return (
        <span className="profile-badges">
            {badges.map((badge) => badge.id.startsWith("fire") ? (
                <img
                    key={badge.id}
                    className="profile-badge profile-badge--fire"
                    src={`/badges/${badge.id}.png`}
                    alt=""
                    title={badge.label}
                    width={20}
                    height={20}
                />
            ) : (
                <span key={badge.id} className="profile-badge profile-badge--crown" title={badge.label}>
                    {badge.id === "top-combo" ? "👑💬" : "👑🔥"}
                </span>
            ))}
        </span>
    );
}
