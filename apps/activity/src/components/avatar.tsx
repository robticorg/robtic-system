const FALLBACK_COLORS = ["#5865f2", "#3ba55d", "#f0883e", "#c56cf0", "#eb459e", "#00a8fc"];

interface AvatarProps {
    src: string | null;
    name: string;
    /** Stable colour seed, so the same user keeps the same placeholder colour. */
    seed: string;
    size: number;
    className?: string;
}

/** Discord CDN avatar with a coloured initial as a fallback when no avatar is available. */
export function Avatar({ src, name, seed, size, className }: AvatarProps) {
    const classes = className ? `avatar ${className}` : "avatar";
    if (src) {
        return <img className={classes} src={src} alt="" width={size} height={size} />;
    }

    const colorIndex = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % FALLBACK_COLORS.length;

    return (
        <div
            className={`${classes} avatar--fallback`}
            style={{
                width: size,
                height: size,
                background: FALLBACK_COLORS[colorIndex],
                fontSize: Math.round(size * 0.42),
            }}
            aria-hidden="true"
        >
            {name.trim().charAt(0).toUpperCase() || "?"}
        </div>
    );
}
