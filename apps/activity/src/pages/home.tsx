import { useState } from "react";
import { useDiscordAuth } from "../hooks/use-discord-auth";
import { useAdminConfig } from "../hooks/use-admin-config";
import { UserSearch } from "../components/user-search";
import { Logo } from "../components/logo";
import { Icon, type IconName } from "../components/icon";
import { ProfileView } from "./profile-view";
import { LeaderboardView } from "./leaderboard-view";
import { AdminView } from "./admin-view";
import { ModerationView } from "./moderation-view";

type Tab = "profile" | "top" | "moderation" | "admin";

const BASE_TABS: { id: Tab; label: string; icon: IconName }[] = [
    { id: "profile", label: "Profile", icon: "user" },
    { id: "top", label: "Top", icon: "trophy" },
];

const ADMIN_TABS: { id: Tab; label: string; icon: IconName }[] = [
    { id: "moderation", label: "Moderate", icon: "scale" },
    { id: "admin", label: "Admin", icon: "gear" },
];

export function Home() {
    const state = useDiscordAuth();
    const [tab, setTab] = useState<Tab>("profile");
    /** Null means "the signed-in user"; set when a search result or leaderboard row is opened. */
    const [viewedUserId, setViewedUserId] = useState<string | null>(null);

    // Only fetch once the SDK handshake has configured the API client with a token + guild id.
    const authed = state.status === "authenticated" && Boolean(state.session.guildId);
    const admin = useAdminConfig(authed);
    const isAdmin = admin.status === "ready" && admin.data.isAdmin;

    if (state.status === "connecting") {
        return (
            <div className="centered">
                <div>
                    <div className="spinner" aria-label="Connecting" />
                    <p className="muted">Connecting to Discord…</p>
                </div>
            </div>
        );
    }

    if (state.status === "error") {
        return (
            <div className="centered">
                <div>
                    <p className="error">Failed to connect</p>
                    <p className="muted">{state.message}</p>
                </div>
            </div>
        );
    }

    if (!state.session.guildId) {
        return (
            <div className="centered">
                <p className="muted">Open this activity inside a server to see profiles and leaderboards.</p>
            </div>
        );
    }

    function openProfile(userId: string) {
        setViewedUserId(userId);
        setTab("profile");
    }

    const tabs = isAdmin ? [...BASE_TABS, ...ADMIN_TABS] : BASE_TABS;
    // If a non-admin lands on an admin tab (bootstrap resolved late), fall back to profile.
    const activeTab: Tab = (tab === "admin" || tab === "moderation") && !isAdmin ? "profile" : tab;

    return (
        <div className="app">
            <nav className="topbar">
                <div className="topbar__inner">
                    <div className="brand">
                        <Logo size={30} />
                        <span className="brand__word">Robtic</span>
                    </div>

                    <div className="tabs" role="tablist">
                        {tabs.map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                className="tab"
                                role="tab"
                                aria-selected={activeTab === t.id}
                                title={t.label}
                                onClick={() => { setTab(t.id); if (t.id === "profile") setViewedUserId(null); }}
                            >
                                <Icon name={t.icon} size={17} />
                                <span className="tab__label">{t.label}</span>
                            </button>
                        ))}
                    </div>

                    <UserSearch onSelect={(r) => openProfile(r.discordId)} />
                </div>
            </nav>

            <div className="app__body">
                {activeTab === "profile" && (
                    <ProfileView userId={viewedUserId} onBack={viewedUserId ? () => setViewedUserId(null) : null} />
                )}
                {activeTab === "top" && <LeaderboardView onSelectUser={openProfile} />}
                {activeTab === "moderation" && isAdmin && <ModerationView />}
                {activeTab === "admin" && isAdmin && admin.status === "ready" && <AdminView data={admin.data} />}
            </div>
        </div>
    );
}
