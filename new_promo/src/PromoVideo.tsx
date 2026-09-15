import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
  Img,
  staticFile,
  Sequence,
} from "remotion";

// ── Easing helpers ──────────────────────────────────────────────────────────
const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

// ── Brand tokens ─────────────────────────────────────────────────────────────
const INDIGO = "#6366F1";
const VIOLET = "#8B5CF6";
const PINK   = "#EC4899";
const GREEN  = "#10B981";
const DARK   = "#090D16";
const SHELL  = "#0D1322";
const CARD   = "rgba(30,41,59,0.85)";
const MUTED  = "#94A3B8";
const WHITE  = "#F1F5F9";

// ── Act boundaries (frames @ 30fps) ──────────────────────────────────────────
// Total: 1800 frames = 60 seconds
// Act 1: 0   – 270   (0–9s)   THE PROBLEM
// Act 2: 270 – 540   (9–18s)  THE DISCOVERY
// Act 3: 540 – 1080  (18–36s) THE FEATURES  (4 × 135f beats)
// Act 4: 1080– 1440  (36–48s) THE PROOF
// Act 5: 1440– 1800  (48–60s) THE CALL TO ACTION

const A1_END  = 270;
const A2_END  = 540;
const A3_END  = 1080;
const A4_END  = 1440;
const A5_END  = 1800;

// Feature beats inside Act 3
const B1_END = A2_END + 135;   // 675  POS
const B2_END = B1_END  + 135;  // 810  Inventory
const B3_END = B2_END  + 135;  // 945  ZATCA
const B4_END = B3_END  + 135;  // 1080 Analytics

// ── Shared style builders ─────────────────────────────────────────────────────
const cairo = (weight: number = 700): React.CSSProperties => ({
  fontFamily: "'Cairo', 'Noto Sans Arabic', sans-serif",
  fontWeight: weight,
  direction: "rtl",
});

// Smooth fade + slide-up entrance, then fade out
function usePresence(
  frame: number,
  inFrame: number,
  outFrame: number,
  fadeLen = 18
) {
  const opacity =
    frame < inFrame
      ? 0
      : frame > outFrame
      ? 0
      : frame < inFrame + fadeLen
      ? interpolate(frame, [inFrame, inFrame + fadeLen], [0, 1])
      : frame > outFrame - fadeLen
      ? interpolate(frame, [outFrame - fadeLen, outFrame], [1, 0])
      : 1;

  const slideY =
    frame < inFrame
      ? 60
      : frame < inFrame + fadeLen * 1.5
      ? interpolate(frame, [inFrame, inFrame + fadeLen * 1.5], [60, 0], {
          easing: easeOutExpo,
        })
      : 0;

  return { opacity, transform: `translateY(${slideY}px)` };
}

// Spring pop-in scale
function useSpringScale(frame: number, fps: number, startFrame: number) {
  if (frame < startFrame) return 0.88;
  const s = spring({ frame: frame - startFrame, fps, config: { damping: 14, mass: 0.6 } });
  return interpolate(s, [0, 1], [0.88, 1]);
}

// ── Sub-components ───────────────────────────────────────────────────────────

/** Indigo→Violet gradient orb */
const Orb: React.FC<{
  x: string; y: string; size: number; color: string; opacity?: number;
}> = ({ x, y, size, color, opacity = 0.35 }) => (
  <div
    style={{
      position: "absolute",
      left: x, top: y,
      width: size, height: size,
      borderRadius: "50%",
      background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
      opacity,
      filter: `blur(${size * 0.45}px)`,
      pointerEvents: "none",
    }}
  />
);

/** Animated pill badge */
const Pill: React.FC<{ label: string; color?: string; bg?: string }> = ({
  label,
  color = INDIGO,
  bg = "rgba(99,102,241,0.15)",
}) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 28px",
      background: bg,
      border: `1px solid ${color}55`,
      borderRadius: 999,
      ...cairo(700),
      fontSize: 22,
      color,
      letterSpacing: "0.04em",
      marginBottom: 24,
    }}
  >
    <span
      style={{
        width: 10, height: 10, borderRadius: "50%",
        background: color, display: "inline-block", flexShrink: 0,
      }}
    />
    {label}
  </div>
);

/** Glass card wrapper */
const GlassCard: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
  accent?: string;
}> = ({ children, style, accent = INDIGO }) => (
  <div
    style={{
      background: CARD,
      border: `1px solid ${accent}33`,
      borderRadius: 24,
      backdropFilter: "blur(24px)",
      padding: "40px 52px",
      ...style,
    }}
  >
    {children}
  </div>
);

/** App screenshot in a glass frame */
const AppScreen: React.FC<{
  src: string; scale?: number; rotation?: number; shadow?: boolean;
}> = ({ src, scale = 1, rotation = 0, shadow = true }) => (
  <div
    style={{
      transform: `scale(${scale}) rotate(${rotation}deg)`,
      borderRadius: 20,
      overflow: "hidden",
      border: `1px solid ${INDIGO}44`,
      boxShadow: shadow
        ? `0 60px 120px rgba(99,102,241,0.35), 0 0 0 1px ${INDIGO}22`
        : "none",
    }}
  >
    <Img src={src} style={{ width: "100%", display: "block" }} />
  </div>
);

/** Big metric block */
const MetricCard: React.FC<{
  value: string; label: string; icon: string; accent?: string;
}> = ({ value, label, icon, accent = INDIGO }) => (
  <GlassCard
    accent={accent}
    style={{ textAlign: "center", minWidth: 260, padding: "36px 44px" }}
  >
    <div style={{ fontSize: 48, marginBottom: 8 }}>{icon}</div>
    <div
      style={{
        ...cairo(900), fontSize: 56,
        background: `linear-gradient(135deg,${accent},${VIOLET})`,
        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      }}
    >
      {value}
    </div>
    <div style={{ ...cairo(600), fontSize: 20, color: MUTED, marginTop: 8 }}>
      {label}
    </div>
  </GlassCard>
);

// ── PARTICLE GRID (decorative background dots) ───────────────────────────────
const ParticleGrid: React.FC<{ frame: number; opacity?: number }> = ({ frame, opacity = 1 }) => {
  const dots = Array.from({ length: 64 }, (_, i) => ({
    x: (i % 8) * 12.5 + 6.25,
    y: Math.floor(i / 8) * 12.5 + 6.25,
    phase: i * 0.4,
  }));
  return (
    <div style={{ position: "absolute", inset: 0, opacity }}>
      {dots.map((d, i) => {
        const flicker = Math.sin(frame * 0.06 + d.phase) * 0.5 + 0.5;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${d.x}%`, top: `${d.y}%`,
              width: 3, height: 3, borderRadius: "50%",
              background: INDIGO,
              opacity: flicker * 0.25,
            }}
          />
        );
      })}
    </div>
  );
};

// ── Horizontal scan line ─────────────────────────────────────────────────────
const ScanLine: React.FC<{ frame: number; opacity?: number }> = ({ frame, opacity = 1 }) => {
  const y = ((frame * 2.5) % 1100) - 8;
  return (
    <div
      style={{
        position: "absolute", left: 0, right: 0,
        top: y, height: 2,
        background: `linear-gradient(90deg, transparent, ${INDIGO}66, transparent)`,
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};

// ── ACTS ─────────────────────────────────────────────────────────────────────

/** Act 1 — THE PROBLEM (0–9s): Dark, messy, painful */
const Act1: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const globalFade = frame > A1_END - 40
    ? interpolate(frame, [A1_END - 40, A1_END], [1, 0])
    : 1;

  const pain1 = usePresence(frame, 20, 140);
  const pain2 = usePresence(frame, 90, 200);
  const pain3 = usePresence(frame, 150, 270);

  // Background color pulses from dark red to near-black
  const redPulse = Math.sin(frame * 0.08) * 0.04 + 0.04;

  return (
    <AbsoluteFill style={{ background: `rgb(${Math.round(18 + redPulse * 255)},8,16)`, opacity: globalFade }}>
      {/* Pain particles */}
      <ParticleGrid frame={frame} opacity={0.3} />

      {/* Central content */}
      <AbsoluteFill
        style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          textAlign: "center", padding: "0 160px", gap: 0,
        }}
      >
        {/* Pain point 1 */}
        <div style={{ position: "absolute", ...pain1 }}>
          <div style={{ ...cairo(400), fontSize: 28, color: "#94A3B8", marginBottom: 20 }}>
            يوم آخر...
          </div>
          <h1
            style={{
              ...cairo(900), fontSize: 88, color: WHITE,
              lineHeight: 1.15, letterSpacing: "-2px",
            }}
          >
            فواتيرك مبعثرة<br />
            <span style={{ color: "#F43F5E" }}>ومخزونك مجهول</span>
          </h1>
        </div>

        {/* Pain point 2 */}
        <div style={{ position: "absolute", ...pain2 }}>
          <h1 style={{ ...cairo(900), fontSize: 80, color: WHITE, lineHeight: 1.2 }}>
            هيئة الزكاة تطلب<br />
            <span style={{ color: "#F43F5E" }}>فاتورة إلكترونية</span><br />
            ولا يوجد نظام؟
          </h1>
        </div>

        {/* Pain point 3 – turning point */}
        <div style={{ position: "absolute", ...pain3 }}>
          <div style={{ ...cairo(600), fontSize: 32, color: MUTED, marginBottom: 16 }}>
            حان الوقت لـ
          </div>
          <h1
            style={{
              ...cairo(900), fontSize: 96,
              background: `linear-gradient(135deg,${INDIGO},${VIOLET})`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              letterSpacing: "-2px",
            }}
          >
            التغيير
          </h1>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Act 2 — THE DISCOVERY (9–18s): Brand sunrise */
const Act2: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const localF = frame - A1_END;
  const dur = A2_END - A1_END;

  const fadeIn  = interpolate(localF, [0, 30], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = frame > A2_END - 40
    ? interpolate(frame, [A2_END - 40, A2_END], [1, 0])
    : 1;

  // Radial burst progress
  const burstProgress = clamp(easeOutExpo(localF / 80), 0, 1);
  const burstSize = interpolate(burstProgress, [0, 1], [0, 1400]);

  const logoScale = useSpringScale(frame, fps, A1_END + 30);
  const taglinePresence = usePresence(frame, A1_END + 50, A2_END);
  const subPresence = usePresence(frame, A1_END + 80, A2_END);

  return (
    <AbsoluteFill
      style={{ background: DARK, opacity: fadeIn * fadeOut }}
    >
      {/* Burst halo */}
      <div
        style={{
          position: "absolute",
          left: "50%", top: "50%",
          width: burstSize, height: burstSize,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(99,102,241,0.22) 0%, transparent 65%)`,
          transform: "translate(-50%,-50%)",
          pointerEvents: "none",
        }}
      />
      <Orb x="0%" y="0%" size={700} color="rgba(99,102,241,0.25)" />
      <Orb x="60%" y="50%" size={500} color="rgba(139,92,246,0.18)" />

      <AbsoluteFill
        style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          textAlign: "center", gap: 0, padding: "0 120px",
        }}
      >
        {/* Logo mark */}
        <div
          style={{
            transform: `scale(${logoScale})`,
            marginBottom: 32,
            width: 120, height: 120,
            background: `linear-gradient(135deg,${INDIGO},${VIOLET})`,
            borderRadius: 32,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 60,
            boxShadow: `0 0 60px rgba(99,102,241,0.6), 0 0 120px rgba(139,92,246,0.3)`,
          }}
        >
          👆
        </div>

        {/* Brand name */}
        <div style={{ ...taglinePresence }}>
          <h1
            style={{
              ...cairo(900), fontSize: 112,
              background: `linear-gradient(135deg,${WHITE} 40%,${VIOLET})`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              letterSpacing: "-3px", lineHeight: 1.05, margin: 0,
            }}
          >
            البصمة الذكية
          </h1>
          <div
            style={{
              fontFamily: "'Inter','Cairo',sans-serif",
              fontSize: 28, color: INDIGO, letterSpacing: "8px",
              textTransform: "uppercase", fontWeight: 700, marginTop: 12,
            }}
          >
            Smart Touch POS
          </div>
        </div>

        {/* Tagline */}
        <div style={{ ...subPresence, marginTop: 36 }}>
          <p style={{ ...cairo(400), fontSize: 30, color: MUTED, maxWidth: 760, lineHeight: 1.7, margin: 0 }}>
            نظام نقاط البيع الأسرع والأكثر ذكاءً في المملكة العربية السعودية
          </p>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Act 3 — THE FEATURES (18–36s): 4 cinematic beats */
const Act3: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const fadeIn = frame < A2_END + 30
    ? interpolate(frame, [A2_END, A2_END + 30], [0, 1])
    : 1;
  const fadeOut = frame > A3_END - 30
    ? interpolate(frame, [A3_END - 30, A3_END], [1, 0])
    : 1;

  // Shared background
  return (
    <AbsoluteFill style={{ background: DARK, opacity: fadeIn * fadeOut }}>
      <Orb x="-10%" y="-10%" size={800} color="rgba(99,102,241,0.12)" />
      <Orb x="70%" y="60%" size={600} color="rgba(139,92,246,0.1)" />
      <ParticleGrid frame={frame} opacity={0.15} />
      <ScanLine frame={frame} opacity={0.4} />

      {/* Beat 1 — POS */}
      {frame >= A2_END && frame < B1_END && (
        <FeatureBeat
          frame={frame} fps={fps}
          inFrame={A2_END} outFrame={B1_END}
          pill="نقطة البيع"
          pillColor={INDIGO}
          headline={<>واجهة كاشير<br /><span style={{ color: INDIGO }}>بلمسة واحدة</span></>}
          sub="باركود، متغيرات، تعديلات — كل عملية بيع في أقل من ٣ ثوانٍ"
          imgSrc={staticFile("assets/2.png")}
          imgRight={false}
          icon="⚡"
        />
      )}

      {/* Beat 2 — Inventory */}
      {frame >= B1_END && frame < B2_END && (
        <FeatureBeat
          frame={frame} fps={fps}
          inFrame={B1_END} outFrame={B2_END}
          pill="إدارة المخزون"
          pillColor="#0891B2"
          headline={<>مخزونك<br /><span style={{ color: "#0891B2" }}>لحظة بلحظة</span></>}
          sub="تتبع الحركة، تنبيهات النفاد، أوامر الشراء — بالكامل تلقائياً"
          imgSrc={staticFile("assets/5.png")}
          imgRight={true}
          icon="📦"
        />
      )}

      {/* Beat 3 — ZATCA */}
      {frame >= B2_END && frame < B3_END && (
        <FeatureBeat
          frame={frame} fps={fps}
          inFrame={B2_END} outFrame={B3_END}
          pill="ZATCA Phase 2"
          pillColor={GREEN}
          headline={<>فواتير ضريبية<br /><span style={{ color: GREEN }}>معتمدة ١٠٠٪</span></>}
          sub="UBL XML، توقيع رقمي، TLV QR Code — رفع تلقائي فوري لهيئة الزكاة"
          imgSrc={staticFile("assets/10.png")}
          imgRight={false}
          icon="🏛️"
        />
      )}

      {/* Beat 4 — Analytics */}
      {frame >= B3_END && frame < B4_END && (
        <FeatureBeat
          frame={frame} fps={fps}
          inFrame={B3_END} outFrame={B4_END}
          pill="التقارير والمحاسبة"
          pillColor={VIOLET}
          headline={<>أرباحك<br /><span style={{ color: VIOLET }}>في متناول يدك</span></>}
          sub="محاسبة مزدوجة القيد، دفتر أستاذ، تقرير ضريبة القيمة المضافة"
          imgSrc={staticFile("assets/1.png")}
          imgRight={true}
          icon="📊"
        />
      )}
    </AbsoluteFill>
  );
};

/** Reusable 2-col feature beat */
const FeatureBeat: React.FC<{
  frame: number; fps: number;
  inFrame: number; outFrame: number;
  pill: string; pillColor: string;
  headline: React.ReactNode; sub: string;
  imgSrc: string; imgRight: boolean; icon: string;
}> = ({ frame, fps, inFrame, outFrame, pill, pillColor, headline, sub, imgSrc, imgRight, icon }) => {
  const local = frame - inFrame;
  const dur   = outFrame - inFrame;

  const textFade = usePresence(frame, inFrame + 10, outFrame, 15);
  const imgProgress = clamp(easeOutBack(local / 50), 0, 1.02);

  const textCol = (
    <div style={{ ...textFade, display: "flex", flexDirection: "column", justifyContent: "center", gap: 20 }}>
      <Pill label={`${icon}  ${pill}`} color={pillColor} bg={`${pillColor}18`} />
      <h2 style={{ ...cairo(900), fontSize: 72, color: WHITE, lineHeight: 1.15, margin: 0 }}>
        {headline}
      </h2>
      <p style={{ ...cairo(400), fontSize: 26, color: MUTED, lineHeight: 1.7, margin: 0, maxWidth: 540 }}>
        {sub}
      </p>
    </div>
  );

  const imgCol = (
    <div
      style={{
        transform: `scale(${imgProgress}) rotate(${imgRight ? 2 : -2}deg)`,
        transformOrigin: "center",
        borderRadius: 20, overflow: "hidden",
        border: `1px solid ${pillColor}44`,
        boxShadow: `0 48px 100px ${pillColor}44`,
        maxWidth: 720,
      }}
    >
      <Img src={imgSrc} style={{ width: "100%", display: "block" }} />
    </div>
  );

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: imgRight ? "row-reverse" : "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 80,
        padding: "60px 100px",
      }}
    >
      {imgRight ? <>{imgCol}{textCol}</> : <>{textCol}{imgCol}</>}
    </AbsoluteFill>
  );
};

/** Act 4 — THE PROOF (36–48s): Real numbers */
const Act4: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const fadeIn = frame < A3_END + 35
    ? interpolate(frame, [A3_END, A3_END + 35], [0, 1])
    : 1;
  const fadeOut = frame > A4_END - 35
    ? interpolate(frame, [A4_END - 35, A4_END], [1, 0])
    : 1;

  const headPresence = usePresence(frame, A3_END + 20, A4_END, 20);
  const card1Scale = useSpringScale(frame, fps, A3_END + 50);
  const card2Scale = useSpringScale(frame, fps, A3_END + 80);
  const card3Scale = useSpringScale(frame, fps, A3_END + 110);
  const card4Scale = useSpringScale(frame, fps, A3_END + 140);

  // Animated counter for the proof section
  const localF = frame - A3_END;
  const testimonial = usePresence(frame, A3_END + 180, A4_END - 40, 20);

  return (
    <AbsoluteFill style={{ background: SHELL, opacity: fadeIn * fadeOut }}>
      <Orb x="50%" y="-20%" size={900} color="rgba(99,102,241,0.1)" />
      <ParticleGrid frame={frame} opacity={0.12} />

      <AbsoluteFill
        style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 60, padding: "60px 80px",
        }}
      >
        <div style={{ ...headPresence, textAlign: "center" }}>
          <Pill label="📈  النتائج تتحدث" color={GREEN} bg="rgba(16,185,129,0.12)" />
          <h2 style={{ ...cairo(900), fontSize: 64, color: WHITE, lineHeight: 1.2, margin: 0 }}>
            أرقام حقيقية من عملاء حقيقيين
          </h2>
        </div>

        {/* Metrics row */}
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap", justifyContent: "center" }}>
          <div style={{ transform: `scale(${card1Scale})` }}>
            <MetricCard value="١٤٨٢" label="فاتورة موقّعة يومياً" icon="🧾" accent={INDIGO} />
          </div>
          <div style={{ transform: `scale(${card2Scale})` }}>
            <MetricCard value="٠" label="مخالفة ZATCA" icon="✅" accent={GREEN} />
          </div>
          <div style={{ transform: `scale(${card3Scale})` }}>
            <MetricCard value="٣ث" label="لإتمام أي فاتورة" icon="⚡" accent={VIOLET} />
          </div>
          <div style={{ transform: `scale(${card4Scale})` }}>
            <MetricCard value="٩٩٪" label="وقت تشغيل مضمون" icon="🛡️" accent="#F59E0B" />
          </div>
        </div>

        {/* Pull quote */}
        <div style={{ ...testimonial, textAlign: "center", maxWidth: 860 }}>
          <GlassCard accent={VIOLET}>
            <p style={{ ...cairo(400), fontSize: 28, color: WHITE, lineHeight: 1.8, margin: 0 }}>
              "البصمة الذكية حوّل طريقة عملنا تماماً —<br />
              <strong style={{ color: VIOLET }}>توفير ٤ ساعات يومياً</strong> وصفر أخطاء في التسويات"
            </p>
            <div style={{ ...cairo(600), fontSize: 20, color: MUTED, marginTop: 16 }}>
              — أحد عملاء البصمة الذكية، الرياض
            </div>
          </GlassCard>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Act 5 — THE CALL TO ACTION (48–60s) */
const Act5: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const fadeIn = frame < A4_END + 35
    ? interpolate(frame, [A4_END, A4_END + 35], [0, 1])
    : 1;

  const logoScale = useSpringScale(frame, fps, A4_END + 30);
  const h1 = usePresence(frame, A4_END + 30, A5_END);
  const sub = usePresence(frame, A4_END + 70, A5_END);
  const btn = usePresence(frame, A4_END + 110, A5_END);
  const contact = usePresence(frame, A4_END + 150, A5_END);

  // Pulsing button glow
  const glow = Math.sin((frame - A4_END) * 0.15) * 0.3 + 0.7;

  return (
    <AbsoluteFill style={{ background: DARK, opacity: fadeIn }}>
      {/* Dramatic burst */}
      <div
        style={{
          position: "absolute",
          left: "50%", top: "50%",
          width: 1200, height: 1200,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 60%)`,
          transform: "translate(-50%,-50%)",
          animation: "none",
        }}
      />
      <Orb x="-5%" y="-5%" size={700} color="rgba(99,102,241,0.2)" />
      <Orb x="65%" y="55%" size={600} color="rgba(139,92,246,0.15)" />
      <Orb x="30%" y="70%" size={400} color="rgba(236,72,153,0.1)" />
      <ParticleGrid frame={frame} opacity={0.2} />
      <ScanLine frame={frame} opacity={0.5} />

      <AbsoluteFill
        style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          textAlign: "center", gap: 0, padding: "0 140px",
        }}
      >
        {/* Logo */}
        <div style={{ transform: `scale(${logoScale})`, marginBottom: 40 }}>
          <div
            style={{
              width: 100, height: 100,
              background: `linear-gradient(135deg,${INDIGO},${VIOLET})`,
              borderRadius: 28,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 50, margin: "0 auto",
              boxShadow: `0 0 ${60 * glow}px rgba(99,102,241,${0.7 * glow})`,
            }}
          >
            👆
          </div>
        </div>

        {/* Headline */}
        <div style={{ ...h1 }}>
          <h1
            style={{
              ...cairo(900), fontSize: 96,
              background: `linear-gradient(135deg,${WHITE} 50%,${VIOLET})`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              letterSpacing: "-3px", lineHeight: 1.1, margin: 0,
            }}
          >
            ارتقِ بعملك اليوم
          </h1>
          <div
            style={{
              fontFamily: "'Inter','Cairo',sans-serif",
              fontSize: 24, color: INDIGO, letterSpacing: "6px",
              textTransform: "uppercase", fontWeight: 700, marginTop: 12,
            }}
          >
            البصمة الذكية · Smart Touch POS
          </div>
        </div>

        {/* Sub */}
        <div style={{ ...sub, marginTop: 32 }}>
          <p style={{ ...cairo(400), fontSize: 28, color: MUTED, lineHeight: 1.7, margin: 0 }}>
            تجربة مجانية ٣٠ يوماً — بدون بطاقة ائتمانية<br />
            إعداد فوري في أقل من ١٠ دقائق
          </p>
        </div>

        {/* CTA button */}
        <div style={{ ...btn, marginTop: 48 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center", gap: 16,
              padding: "24px 64px",
              background: `linear-gradient(135deg,${INDIGO},${VIOLET})`,
              borderRadius: 999,
              ...cairo(800), fontSize: 32, color: WHITE,
              boxShadow: `0 16px 60px rgba(99,102,241,${0.5 * glow})`,
              border: "1px solid rgba(255,255,255,0.15)",
            }}
          >
            ابدأ تجربتك المجانية
            <span>←</span>
          </div>
        </div>

        {/* Contact */}
        <div style={{ ...contact, marginTop: 48 }}>
          <div style={{ display: "flex", gap: 48, justifyContent: "center" }}>
            <div style={{ ...cairo(600), fontSize: 22, color: MUTED }}>
              📧 ea.gaber10@gmail.com
            </div>
            <div style={{ ...cairo(600), fontSize: 22, color: MUTED }}>
              💬 +966 53 317 4895
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── ROOT COMPOSITION ─────────────────────────────────────────────────────────
export const PromoVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      {/* Act 1: The Problem */}
      {frame < A1_END + 10 && <Act1 frame={frame} fps={fps} />}

      {/* Act 2: The Discovery */}
      {frame >= A1_END - 10 && frame < A2_END + 10 && (
        <AbsoluteFill style={{ opacity: frame < A1_END ? 0 : 1 }}>
          <Act2 frame={frame} fps={fps} />
        </AbsoluteFill>
      )}

      {/* Act 3: The Features */}
      {frame >= A2_END - 10 && frame < A3_END + 10 && (
        <AbsoluteFill style={{ opacity: frame < A2_END ? 0 : 1 }}>
          <Act3 frame={frame} fps={fps} />
        </AbsoluteFill>
      )}

      {/* Act 4: The Proof */}
      {frame >= A3_END - 10 && frame < A4_END + 10 && (
        <AbsoluteFill style={{ opacity: frame < A3_END ? 0 : 1 }}>
          <Act4 frame={frame} fps={fps} />
        </AbsoluteFill>
      )}

      {/* Act 5: The CTA */}
      {frame >= A4_END - 10 && (
        <AbsoluteFill style={{ opacity: frame < A4_END ? 0 : 1 }}>
          <Act5 frame={frame} fps={fps} />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
