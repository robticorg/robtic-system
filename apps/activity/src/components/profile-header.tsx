import type { Profile } from "../types/profile";
import { Avatar } from "./avatar";
import { formatRank } from "../utils/format";

export function ProfileHeader({ profile }: { profile: Profile }) {
    return (
        <header className="profile-header">
            <Avatar src={profile.avatarUrl} name={profile.displayName} seed={profile.discordId} size={72} className="profile-header__avatar" />
            <div style={{ minWidth: 0 }}>
                <h1 className="profile-header__name">{profile.displayName}</h1>
                <p className="profile-header__sub">
                    @{profile.username} · Level {profile.xp.level} · {formatRank(profile.xp.rank)} in server
                </p>
                {profile.isPrivate && <span className="badge">🔒 Private profile</span>}
            </div>
        </header>
    );
}
