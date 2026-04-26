"use client";

import { useState } from "react";

type Props = { size?: number; showWordmark?: boolean; className?: string };

// Renders the official Chryselys logo from /public/chryselys-logo.png if present.
// Falls back to an SVG approximation (concentric arcs of gold + navy tiles forming a "C")
// so the app still renders correctly until the asset is dropped in.
export function ChryselysLogo({ size = 48, showWordmark = false, className }: Props) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div
      className={className}
      style={{ display: "inline-flex", flexDirection: "row", alignItems: "center", gap: showWordmark ? 8 : 0 }}
    >
      {!imgFailed ? (
        // The actual brand mark (the wordmark is baked into the image)
        <img
          src="/chryselys-logo.png"
          alt="Chryselys"
          width={showWordmark ? size * 2.6 : size}
          height={size}
          style={{ objectFit: "contain", display: "block" }}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <ChryselysSvgFallback size={size} showWordmark={showWordmark} />
      )}
    </div>
  );
}

function ChryselysSvgFallback({ size, showWordmark }: { size: number; showWordmark: boolean }) {
  const cx = 100;
  const cy = 100;
  const tiles: { angle: number; radius: number; size: number; rot: number; fill: string; opacity: number }[] = [];

  const colors = ["#C98B27", "#A26F1C", "#004466", "#0A5C82"];
  const ringCount = 9;
  for (let r = 0; r < ringCount; r++) {
    const radius = 30 + r * 7;
    const tilesInRing = 14 + r * 6;
    const startDeg = 35 + r * 4;
    const endDeg = 360 - 35 - r * 4;
    for (let i = 0; i < tilesInRing; i++) {
      const t = i / (tilesInRing - 1);
      const angle = startDeg + t * (endDeg - startDeg);
      const seed = (r * 13 + i * 7) % 11;
      if (seed < 2) continue;
      const colorIdx = seed % colors.length;
      const tileSize = 3 + (seed % 3);
      const rot = angle - 90 + (seed % 5) * 4;
      const opacity = 0.55 + ((seed * 17) % 45) / 100;
      tiles.push({ angle, radius, size: tileSize, rot, fill: colors[colorIdx], opacity });
    }
  }

  return (
    <div style={{ display: "inline-flex", flexDirection: showWordmark ? "column" : "row", alignItems: "center", gap: 4 }}>
      <svg width={size} height={size} viewBox="0 0 200 200" aria-label="Chryselys">
        <g>
          {tiles.map((t, i) => {
            const rad = (t.angle * Math.PI) / 180;
            const x = cx + Math.cos(rad) * t.radius;
            const y = cy + Math.sin(rad) * t.radius;
            return (
              <rect
                key={i}
                x={x - t.size / 2}
                y={y - t.size * 1.2}
                width={t.size}
                height={t.size * 2.4}
                fill={t.fill}
                opacity={t.opacity}
                transform={`rotate(${t.rot} ${x} ${y})`}
                rx={0.6}
              />
            );
          })}
        </g>
      </svg>
      {showWordmark && (
        <div style={{ textAlign: "center", lineHeight: 1 }}>
          <div style={{ color: "#C98B27", fontFamily: "Lato, sans-serif", fontWeight: 900, fontSize: size * 0.32, letterSpacing: "0.06em" }}>
            CHRYSELYS
          </div>
          <div style={{ color: "#5C6770", fontFamily: "Open Sans, sans-serif", fontSize: size * 0.13, marginTop: 2, letterSpacing: "0.04em" }}>
            Data. Impacts. Lives.
          </div>
        </div>
      )}
    </div>
  );
}
