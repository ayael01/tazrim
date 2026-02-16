import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const palette = {
  bgA: "#fff8f3",
  bgB: "#f3f0ff",
  bgC: "#eef7ff",
  ink: "#14131a",
  muted: "#6a6775",
  accent: "#ff8a4b",
  accentDeep: "#ff5c47",
  card: "rgba(255,255,255,0.86)",
  stroke: "rgba(20, 19, 26, 0.12)",
};

const containerStyle = {
  fontFamily: "Space Grotesk, Arial, sans-serif",
  color: palette.ink,
  background:
    "radial-gradient(circle at top right, #ffe3cf 0%, #f4efff 42%, #eef7ff 100%)",
};

const orb = (size, top, left, colors) => ({
  position: "absolute",
  width: size,
  height: size,
  borderRadius: "9999px",
  top,
  left,
  background: `linear-gradient(145deg, ${colors[0]}, ${colors[1]})`,
  opacity: 0.35,
});

const GlassCard = ({ children, style }) => (
  <div
    style={{
      background: palette.card,
      border: `1px solid ${palette.stroke}`,
      borderRadius: 26,
      boxShadow: "0 20px 50px rgba(28, 19, 54, 0.14)",
      backdropFilter: "blur(9px)",
      padding: "24px 26px",
      ...style,
    }}
  >
    {children}
  </div>
);

const Meter = ({ label, value, color }) => (
  <div style={{ display: "grid", gap: 8 }}>
    <div style={{ fontSize: 24, color: palette.muted }}>{label}</div>
    <div style={{ fontSize: 46, fontWeight: 700, color }}>{value}</div>
  </div>
);

const SceneFrame = ({ title, subtitle, children }) => (
  <GlassCard
    style={{
      position: "absolute",
      left: 88,
      right: 88,
      top: 120,
      bottom: 88,
      overflow: "hidden",
    }}
  >
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
      <div>
        <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1 }}>{title}</div>
        <div style={{ fontSize: 30, color: palette.muted, marginTop: 14 }}>{subtitle}</div>
      </div>
      <div style={{ fontSize: 24, color: palette.muted, marginTop: 12 }}>TAZRIM</div>
    </div>
    <div style={{ marginTop: 34 }}>{children}</div>
  </GlassCard>
);

const BarsMock = ({ frame }) => {
  const heights = [120, 220, 160, 200, 180, 260, 210, 185, 245, 200, 150, 230];
  return (
    <div style={{ display: "flex", alignItems: "end", gap: 14, height: 300 }}>
      {heights.map((h, i) => {
        const grow = spring({
          frame: frame - i * 2,
          fps: 30,
          config: { damping: 15, stiffness: 110 },
        });
        return (
          <div
            key={i}
            style={{
              width: 48,
              height: Math.max(8, h * grow),
              borderRadius: 12,
              background:
                i % 2 === 0
                  ? "linear-gradient(180deg, #3aa0ff, #3b6de1)"
                  : "linear-gradient(180deg, #ff9f62, #ff6f4d)",
            }}
          />
        );
      })}
    </div>
  );
};

const LineMock = ({ frame }) => {
  const points = [0.32, 0.55, 0.42, 0.63, 0.39, 0.71, 0.5, 0.58, 0.44, 0.67, 0.53, 0.74];
  const visible = Math.min(points.length, Math.max(2, Math.floor(frame / 6)));
  const view = points.slice(0, visible);
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Meter label="Total spent" value="NIS 563,460" color={palette.ink} />
        <Meter label="Avg monthly" value="NIS 46,955" color={palette.accentDeep} />
      </div>
      <div style={{ height: 280, display: "flex", alignItems: "end", gap: 18 }}>
        {view.map((p, i) => (
          <div key={i} style={{ display: "grid", justifyItems: "center", gap: 8 }}>
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 20,
                background: "#3aa0ff",
                transform: `translateY(${-220 * p}px)`,
              }}
            />
            <div style={{ width: 2, height: 220 * p, background: "rgba(58,160,255,0.22)" }} />
          </div>
        ))}
      </div>
    </div>
  );
};

const TableMock = ({ frame }) => {
  const rows = [
    ["2026-02-06", "Super", "Food", "NIS 307.9"],
    ["2026-02-05", "Groceries", "Food", "NIS 506.9"],
    ["2026-02-01", "Fuel", "Transport", "NIS 400.0"],
    ["2026-01-31", "Wolt", "Dining", "NIS 116.5"],
    ["2026-01-30", "Taxi", "Transport", "NIS 42.4"],
  ];
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 14 }}>
        <GlassCard style={{ flex: 1, borderRadius: 16, padding: "14px 16px" }}>
          <div style={{ fontSize: 22, color: palette.muted }}>Card transactions with billed dates</div>
        </GlassCard>
        <GlassCard style={{ width: 380, borderRadius: 16, padding: "14px 16px" }}>
          <div style={{ fontSize: 22, color: palette.muted }}>Excel export with multiple sheets</div>
        </GlassCard>
      </div>
      <div style={{ border: `1px solid ${palette.stroke}`, borderRadius: 18, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 1.4fr 1fr 1fr",
            background: "rgba(20,19,26,0.05)",
            padding: "12px 16px",
            fontSize: 20,
            fontWeight: 700,
          }}
        >
          <div>Date</div>
          <div>Merchant</div>
          <div>Category</div>
          <div>Amount</div>
        </div>
        {rows.map((row, idx) => {
          const y = interpolate(frame, [0, 100], [20, 0], { extrapolateRight: "clamp" });
          const opacity = interpolate(frame, [idx * 8, idx * 8 + 20], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={idx}
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1.4fr 1fr 1fr",
                padding: "14px 16px",
                fontSize: 22,
                borderTop: `1px solid ${palette.stroke}`,
                transform: `translateY(${y}px)`,
                opacity,
              }}
            >
              <div>{row[0]}</div>
              <div>{row[1]}</div>
              <div>{row[2]}</div>
              <div style={{ fontWeight: 700 }}>{row[3]}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Intro = ({ frame }) => {
  const fade = interpolate(frame, [0, 24], [0, 1], { extrapolateRight: "clamp" });
  const rise = interpolate(frame, [0, 28], [24, 0], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={containerStyle}>
      <div style={orb(300, -70, 1440, ["#ffd8bf", "#ffb08b"])} />
      <div style={orb(220, 700, -40, ["#c7d9ff", "#efd1ff"])} />
      <GlassCard
        style={{
          position: "absolute",
          left: 140,
          right: 140,
          top: 250,
          padding: "52px 56px",
          transform: `translateY(${rise}px)`,
          opacity: fade,
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: "0.24em", color: palette.muted }}>TAZRIM</div>
        <div style={{ fontSize: 96, fontWeight: 700, lineHeight: 1.02, marginTop: 18 }}>
          Product Demo
        </div>
        <div style={{ fontSize: 40, color: palette.muted, marginTop: 20 }}>
          Banking and credit insights in one workflow
        </div>
      </GlassCard>
    </AbsoluteFill>
  );
};

export const TazrimProductDemo = ({ year = 2025 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const footerOpacity = interpolate(frame, [0, 40, 860, 899], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={containerStyle}>
      <Sequence from={0} durationInFrames={150}>
        <Intro frame={frame} />
      </Sequence>

      <Sequence from={150} durationInFrames={180}>
        <AbsoluteFill style={containerStyle}>
          <SceneFrame
            title="Bank activities"
            subtitle={`Unified view for ${year}: income vs expenses with category composition`}
          >
            <BarsMock frame={frame - 150} />
          </SceneFrame>
        </AbsoluteFill>
      </Sequence>

      <Sequence from={330} durationInFrames={180}>
        <AbsoluteFill style={containerStyle}>
          <SceneFrame
            title="Category insights"
            subtitle="Monthly trend, matrix view, and fast drill-down by category"
          >
            <LineMock frame={frame - 330} />
          </SceneFrame>
        </AbsoluteFill>
      </Sequence>

      <Sequence from={510} durationInFrames={180}>
        <AbsoluteFill style={containerStyle}>
          <SceneFrame
            title="Card transactions + exports"
            subtitle="Reassign categories, inspect billed dates, and export complete Excel reports"
          >
            <TableMock frame={frame - 510} />
          </SceneFrame>
        </AbsoluteFill>
      </Sequence>

      <Sequence from={690} durationInFrames={210}>
        <AbsoluteFill style={containerStyle}>
          <SceneFrame
            title="Built for decision clarity"
            subtitle="One app for imports, classification, analytics, and shareable reporting"
          >
            <div style={{ display: "grid", gap: 18, marginTop: 6 }}>
              {[
                "Bank + credit flows under one navigation",
                "Category and merchant trend analysis",
                "Drill-down details with manual corrections",
                "Rich Excel exports for operational reporting",
              ].map((line, idx) => {
                const pop = spring({
                  fps,
                  frame: frame - 710 - idx * 8,
                  config: { damping: 14, stiffness: 120 },
                });
                return (
                  <GlassCard
                    key={line}
                    style={{
                      borderRadius: 14,
                      padding: "14px 16px",
                      transform: `scale(${0.95 + pop * 0.05})`,
                      opacity: pop,
                    }}
                  >
                    <div style={{ fontSize: 30, color: palette.ink }}>{line}</div>
                  </GlassCard>
                );
              })}
            </div>
          </SceneFrame>
        </AbsoluteFill>
      </Sequence>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 26,
          textAlign: "center",
          fontSize: 24,
          color: palette.muted,
          opacity: footerOpacity,
        }}
      >
        tazrim.app demo timeline
      </div>
    </AbsoluteFill>
  );
};
