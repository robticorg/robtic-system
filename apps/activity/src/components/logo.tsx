/** The RoBo mascot — a glossy blue robot head with big white eyes, rebuilt as an inline SVG brand mark. */
export function Logo({ size = 30 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-label="Robtic" role="img">
            <defs>
                <linearGradient id="robo-head" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#2b93ff" />
                    <stop offset="0.5" stopColor="#0b4fb8" />
                    <stop offset="1" stopColor="#05264f" />
                </linearGradient>
                <radialGradient id="robo-glow" cx="0.5" cy="0.35" r="0.7">
                    <stop offset="0" stopColor="#5cb3ff" stopOpacity="0.9" />
                    <stop offset="1" stopColor="#5cb3ff" stopOpacity="0" />
                </radialGradient>
            </defs>
            <circle cx="24" cy="23" r="21" fill="url(#robo-glow)" />
            <path d="M13 6h1v3h20V6h1v3.4A9 9 0 0 1 42 18v10a9 9 0 0 1-9 9H15a9 9 0 0 1-9-9V18a9 9 0 0 1 7-8.6V6Z" fill="url(#robo-head)" stroke="#8fd0ff" strokeWidth="1.1" />
            <ellipse cx="18.5" cy="23" rx="4.1" ry="4.6" fill="#f4faff" />
            <ellipse cx="29.5" cy="23" rx="4.1" ry="4.6" fill="#f4faff" />
            <ellipse cx="18.9" cy="24" rx="1.7" ry="2" fill="#0a3c7a" />
            <ellipse cx="29.9" cy="24" rx="1.7" ry="2" fill="#0a3c7a" />
            <path d="M20 32h8" stroke="#8fd0ff" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
    );
}
