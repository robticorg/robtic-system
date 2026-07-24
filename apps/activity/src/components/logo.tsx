/** The Robtic brand mark — served from public/logo.png (source: images/logo.png, downscaled). */
export function Logo({ size = 30 }: { size?: number }) {
    return (
        <img
            src="/logo.png"
            alt="Robtic"
            width={size}
            height={size}
            style={{ borderRadius: "22%", display: "block" }}
        />
    );
}
