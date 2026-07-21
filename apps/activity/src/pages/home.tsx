import { useDiscordAuth } from "../hooks/use-discord-auth";

export function Home() {
    const state = useDiscordAuth();

    if (state.status === "connecting") {
        return <p>Connecting to Discord…</p>;
    }
    if (state.status === "error") {
        return <p style={{ color: "#f23f43" }}>Failed to connect: {state.message}</p>;
    }

    const { user } = state.auth;
    const avatarUrl = user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
        : `https://cdn.discordapp.com/embed/avatars/0.png`;

    return (
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <img src={avatarUrl} alt="" width={64} height={64} style={{ borderRadius: "50%" }} />
            <div>
                <h1 style={{ margin: 0 }}>Robtic Activity</h1>
                <p style={{ margin: 0 }}>Authenticated as {user.global_name ?? user.username}</p>
            </div>
        </div>
    );
}
