import { interpolate, spring } from "remotion";

/* ── Reusable Brand Mark ─────────────────────────────────────── */

export function BrandMark({ size = 48 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        background: "linear-gradient(135deg, #3b82f6, #2563eb)",
        borderRadius: size * 0.24,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.48,
        boxShadow: "0 4px 20px rgba(37, 99, 235, 0.35)",
        lineHeight: 1,
      }}
    >
      🏪
    </div>
  );
}

/* ── Floating Brand Emblem (bottom-right of Stage) ───────────── */

export function AppIcon({
  beatName,
  frame,
  fps,
}: {
  beatName: string;
  frame: number;
  fps: number;
}) {
  // Hidden during full-bleed scenes
  if (["hook", "reveal", "outro"].includes(beatName)) return null;

  const entryProgress = spring({
    frame,
    fps,
    config: { damping: 14 },
  });
  const opacity = interpolate(entryProgress, [0, 1], [0, 0.65]);

  return (
    <div
      style={{
        position: "absolute",
        right: 48,
        bottom: 40,
        opacity,
        transform: `scale(${0.6 + entryProgress * 0.4})`,
        zIndex: 1000,
      }}
    >
      <BrandMark size={52} />
    </div>
  );
}
