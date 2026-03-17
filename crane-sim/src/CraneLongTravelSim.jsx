import React, { useState, useEffect, useRef } from "react";

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const styles = {
  container: {
    fontFamily: "'Sarabun', sans-serif",
    padding: "10px 16px",
    width: "100%",
    boxSizing: "border-box",
    backgroundColor: "#eceff1",
    height: "100vh",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    textAlign: "center",
    color: "#37474f",
    marginBottom: "8px",
    fontSize: "18px",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: "1px",
    flexShrink: 0,
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "320px 1fr",
    gap: "12px",
    alignItems: "stretch",
    flex: 1,
    overflow: "hidden",
    minHeight: 0,
  },
  leftPanel: {
    backgroundColor: "white",
    padding: "14px",
    borderRadius: "14px",
    boxShadow: "0 4px 15px rgba(0,0,0,0.08)",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    overflowY: "auto",
    height: "100%",
    boxSizing: "border-box",
  },
  rightPanel: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    overflowY: "auto",
    height: "100%",
    boxSizing: "border-box",
  },
  inputGroup: { display: "flex", flexDirection: "column", gap: "6px" },
  label: {
    display: "flex",
    justifyContent: "space-between",
    fontWeight: "700",
    color: "#546e7a",
    fontSize: "13px",
  },
  slider: { width: "100%", accentColor: "#00838f", height: "6px", cursor: "pointer" },
  vizRow: { display: "grid", gridTemplateColumns: "auto 1fr", gap: "12px", alignItems: "stretch", flexShrink: 0 },
  card: {
    backgroundColor: "white",
    padding: "12px",
    borderRadius: "14px",
    boxShadow: "0 4px 15px rgba(0,0,0,0.05)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  btnGroup: { display: "flex", gap: "8px", justifyContent: "center", marginTop: "8px", flexWrap: "wrap" },
  btn: {
    padding: "12px 18px",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "bold",
    transition: "all 0.1s",
    color: "white",
    boxShadow: "0 3px 0 rgba(0,0,0,0.1)",
    userSelect: "none",
    touchAction: "manipulation",
    flex: 1,
  },
  dirBtn: {
    padding: "8px 16px",
    borderRadius: "8px",
    border: "2px solid #b0bec5",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "bold",
    transition: "all 0.15s",
    userSelect: "none",
    flex: 1,
  },
  skewAlert: {
    backgroundColor: "#ffebee",
    color: "#c62828",
    padding: "8px 12px",
    borderRadius: "8px",
    textAlign: "center",
    fontWeight: "bold",
    border: "1px solid #ffcdd2",
    fontSize: "13px",
  },
  phaseBadge: {
    display: "inline-block",
    padding: "3px 12px",
    borderRadius: "20px",
    fontWeight: "bold",
    fontSize: "12px",
    marginBottom: "6px",
  },
  divider: {
    borderTop: "1px solid #eceff1",
    margin: "2px 0",
  },
};

// Beam section data (JIS G 3192)
// J  = St. Venant torsion constant (mm⁴) = Σ(b·t³)/3
// Cw = Warping constant (mm⁶) = I_yf · h_o² / 2  (h_o = depth − tf)
const BEAM_SECTIONS = {
  "H600×300": {
    label: "H600×300 (H588×300×12×20)",
    Iy_cm4: 9010, depth: 588, tf: 20, tw: 12, b: 300,
    J_mm4: 1915755,
    Cw_mm6: 7.259e12,
  },
  "H500×300": {
    label: "H500×300 (H488×300×11×18)",
    Iy_cm4: 8110, depth: 488, tf: 18, tw: 11, b: 300,
    J_mm4: 1366937,
    Cw_mm6: 4.473e12,
  },
};

// Weld allowable shear stress (AWS D1.1 / AISC)
const WELD_ALLOW = { E6013: 0.3 * 420, E7016: 0.3 * 480 }; // MPa

// Lateral stiffness: K = 48EI_y/L³  (simply supported, 5m span)
// K[N/mm] → K[ton/mm] ÷ 9810
const BEAM_SPAN_MM = 5000;
const E_STEEL = 200000; // N/mm²
const G_STEEL = 80000;  // N/mm²
const K_TIEBACK_LONG  = 24.2; // ton/mm — stiff rod to building column (Long Travel)
const K_TIEBACK_CROSS = 0.5;  // ton/mm — end clamp / lateral guide on end truck (Cross Travel)
const RAIL_HEIGHT_MM  = 60;   // Square bar rail height on top of flange

function calcKbeam(Iy_cm4) {
  const Iy_mm4 = Iy_cm4 * 1e4;
  const K_N_mm = (48 * E_STEEL * Iy_mm4) / (BEAM_SPAN_MM ** 3);
  return K_N_mm / 9810; // ton/mm
}

// Speed-based acceleration (Speed 1=15 m/min, Speed 2=30 m/min)
const SPEED_1_MS = 15 / 60;   // 0.25 m/s
const SPEED_2_MS = 30 / 60;   // 0.50 m/s
const T_SOFT   = 5;            // ramp time soft start (s)
const T_HARD   = 3;            // ramp time hard start (s)
const T_BRAKE  = 2;            // braking time (s)
const G_MS2    = 9.81;

const ACCEL_SOFT  = SPEED_1_MS / T_SOFT  / G_MS2;  // ~0.0051g
const ACCEL_HARD  = SPEED_2_MS / T_HARD  / G_MS2;  // ~0.0170g
const ACCEL_BRAKE = SPEED_2_MS / T_BRAKE / G_MS2;  // ~0.0255g

// ── Cross Travel (trolley on bridge girder) ──────────────────────────────
// Bridge girder sections (JIS G3192-like WF, computed from dims)
const BEAM_SECTIONS_CROSS = {
  "H900×300": {
    label: "H900×300 (H900×300×16×28)", Iy_cm4: 12629, depth: 900, tf: 28, tw: 16, b: 300,
    J_mm4: 5543509, Cw_mm6: 2.394e13,
  },
  "H800×300": {
    label: "H800×300 (H800×300×14×26)", Iy_cm4: 11717, depth: 800, tf: 26, tw: 14, b: 300,
    J_mm4: 4199637, Cw_mm6: 1.717e13,
  },
};
const BEAM_SPAN_CROSS_MM = 23600;       // crane span used as bridge girder span
const SPEED_1_CROSS_MS   = 10 / 60;    // 10 m/min cross travel Speed 1
const SPEED_2_CROSS_MS   = 20 / 60;    // 20 m/min cross travel Speed 2
const ACCEL_SOFT_CROSS   = SPEED_1_CROSS_MS / T_SOFT  / G_MS2;
const ACCEL_HARD_CROSS   = SPEED_2_CROSS_MS / T_HARD  / G_MS2;
const ACCEL_BRAKE_CROSS  = SPEED_2_CROSS_MS / T_BRAKE / G_MS2;

const CraneLongTravelSim = () => {
  const span = 23.6;
  const craneMass = 20.8;
  const trolleyMass = 2.2;

  const [load, setLoad] = useState(25);
  const [trolleyPos, setTrolleyPos] = useState(3.0);
  const [hasTieBack, setHasTieBack] = useState(false);
  const [beamKey, setBeamKey] = useState("H600×300");
  const [weldSize, setWeldSize] = useState(8);
  const [electrode, setElectrode] = useState("E7016");
  const [dir, setDir] = useState("forward");
  const [accelMode, setAccelMode] = useState(0); // 0=idle, 1=soft, 2=hard, 3=brake
  const [mode, setMode] = useState("long");       // "long" | "cross"
  const [beamKeyCross, setBeamKeyCross] = useState("H900×300");
  const [hasVFD, setHasVFD] = useState(false);   // Inverter / VFD
  const [vfdRamp, setVfdRamp] = useState(8);      // VFD ramp time (s), user-set
  const [syncDrive, setSyncDrive] = useState(false); // Synchronized dual-drive

  const [skewAngle, setSkewAngle] = useState(0);
  const [lateralForce, setLateralForce] = useState(0);
  const [beamTwist, setBeamTwist] = useState(0);
  const [torsionDisp, setTorsionDisp] = useState(0);
  const [totalTopDisp, setTotalTopDisp] = useState(0);
  const [twistAngleDeg, setTwistAngleDeg] = useState(0);
  const [weldStress, setWeldStress] = useState(0);
  const [weldUtil, setWeldUtil] = useState(0);
  const [affectedRail, setAffectedRail] = useState("none");

  useEffect(() => {
    // ── Mode-dependent parameters ──────────────────────────────────────────
    const sections  = mode === "long" ? BEAM_SECTIONS      : BEAM_SECTIONS_CROSS;
    const bKey      = mode === "long" ? beamKey            : beamKeyCross;
    const spanMM    = mode === "long" ? BEAM_SPAN_MM       : BEAM_SPAN_CROSS_MM;
    // VFD overrides ramp time — both speeds use the same user-set ramp
    // No VFD: star-delta typical T~1.5s (Speed1) and ~1s (Speed2) — aggressive
    const tS1 = hasVFD ? vfdRamp       : (mode === "long" ? T_SOFT  : T_SOFT);
    const tS2 = hasVFD ? vfdRamp       : (mode === "long" ? T_HARD  : T_HARD);
    const tBr = hasVFD ? vfdRamp * 0.8 : T_BRAKE; // VFD braking also softer
    const spd1 = mode === "long" ? SPEED_1_MS       : SPEED_1_CROSS_MS;
    const spd2 = mode === "long" ? SPEED_2_MS       : SPEED_2_CROSS_MS;
    const noVfdT1 = mode === "long" ? 1.5 : 1.0;   // no-VFD reference ramp times
    const noVfdT2 = mode === "long" ? 1.0 : 0.8;
    const aSoft  = hasVFD ? spd1 / tS1 / G_MS2 : (mode === "long" ? spd1/noVfdT1/G_MS2 : spd1/noVfdT1/G_MS2);
    const aHard  = hasVFD ? spd2 / tS2 / G_MS2 : (mode === "long" ? spd2/noVfdT2/G_MS2 : spd2/noVfdT2/G_MS2);
    const aBrake = hasVFD ? spd2 / tBr / G_MS2 : spd2 / T_BRAKE / G_MS2;

    const accel = accelMode === 1 ? aSoft : accelMode === 2 ? aHard : accelMode === 3 ? aBrake : 0;

    // ── Mass distribution ──────────────────────────────────────────────────
    // Long Travel: crane body + trolley + load, asymmetric by trolley position
    // Cross Travel: trolley + load only, symmetric (skew is purely inertia-driven)
    let massLeft, massRight;
    if (mode === "long") {
      const totalLoad = load + trolleyMass;
      massLeft  = craneMass / 2 + (totalLoad * (span - trolleyPos)) / span;
      massRight = craneMass / 2 + (totalLoad * trolleyPos) / span;
    } else {
      const half = (load + trolleyMass) / 2;
      massLeft  = half;
      massRight = half;
    }

    const forceReqL  = massLeft  * accel;
    const forceReqR  = massRight * accel;
    const inertiaDiff = Math.abs(forceReqL - forceReqR);

    let sideThrust = inertiaDiff * 1.5;
    if (accelMode > 0) {
      const vertWheelLoad = Math.max(massLeft, massRight) / 2;
      sideThrust += vertWheelLoad * 0.05;
      // Cross Travel: masses are symmetric → inertiaDiff = 0, but end truck skew
      // during acceleration still scales with accel (differential drive response)
      if (mode === "cross") {
        sideThrust += (load + trolleyMass) * accel * 0.1;
      }
    }

    // ── Lateral stiffness + beam displacement (actual, mm) ────────────────
    const sec      = sections[bKey];
    const kBeam    = calcKbeam(sec.Iy_cm4);
    const kBeamFn  = (Iy) => {
      const Iy_mm4   = Iy * 1e4;
      return (48 * E_STEEL * Iy_mm4) / (spanMM ** 3) / 9810;
    };
    const kBeamActual  = kBeamFn(sec.Iy_cm4);
    const kTieBack     = mode === "long" ? K_TIEBACK_LONG : K_TIEBACK_CROSS;
    const kStiffness   = hasTieBack ? kBeamActual + kTieBack : kBeamActual;
    const beamDispMm   = sideThrust / kStiffness;  // actual lateral deflection (mm)

    // ── Torsional calculation ──────────────────────────────────────────────
    // Tie-back at top flange adds torsional spring: k_tors_tb = k_tb[N/mm] × h²[mm²]
    // where h = depth/2 (distance from shear center to top flange for doubly-sym I-beam)
    // phi_rad = T / (k_eq_beam + k_tors_tb)
    // k_eq_beam = phiDenom × kTors / spanMM  [N·mm/rad]
    const fractionToBeam = hasTieBack ? kBeamActual / (kBeamActual + kTieBack) : 1.0;
    const e_mm  = sec.depth - sec.tf / 2 + RAIL_HEIGHT_MM;
    const T_Nmm = sideThrust * 9810 * e_mm;
    // Long Travel: bottom flange WELDED to column plate → warping restrained both ends
    //   kTors = GJ + 4π²ECw/L²  (fixed-fixed warping)
    // Cross Travel: girder end rests on END TRUCK SADDLE (bearing/pin) → warping FREE
    //   kTors = GJ + π²ECw/L²   (pin-pin warping free)
    const warpFactor = mode === "long" ? 4 : 1;   // 4π² vs π²
    const phiDenom   = mode === "long" ? 4 : 8;
    const kTors      = G_STEEL * sec.J_mm4 + warpFactor * Math.PI ** 2 * E_STEEL * sec.Cw_mm6 / spanMM ** 2;
    const kEqBeam    = phiDenom * kTors / spanMM;                                  // N·mm/rad
    const h_tb       = sec.depth / 2;                                              // mm
    const kTorsTb    = hasTieBack ? (kTieBack * 9810) * h_tb ** 2 : 0;            // N·mm/rad
    const phi_rad    = T_Nmm / (kEqBeam + kTorsTb);
    const phi_deg = phi_rad * (180 / Math.PI);
    const torsionDispMm  = phi_rad * e_mm;
    const totalTopDispMm = beamDispMm + torsionDispMm;

    setTorsionDisp(torsionDispMm);
    setTotalTopDisp(totalTopDispMm);
    setTwistAngleDeg(phi_deg);

    // ── Weld stress ────────────────────────────────────────────────────────
    const F_weld_N  = sideThrust * 9810 * fractionToBeam;
    const F_M_N     = F_weld_N * e_mm / sec.b;
    const F_res_N   = Math.sqrt(F_weld_N ** 2 + F_M_N ** 2);
    const a_weld    = 0.707 * weldSize;
    const A_weld    = 2 * sec.b * a_weld;
    const tau       = F_res_N / A_weld;
    setWeldStress(tau);
    setWeldUtil(tau / WELD_ALLOW[electrode] * 100);

    // ── Skew sign ──────────────────────────────────────────────────────────
    const dirSign      = dir === "forward" ? 1 : -1;
    const phaseSign    = accelMode === 3 ? -1 : 1;
    // Synchronized dual-drive VFD: both ends run at same speed → no positional asymmetry
    // Cross Travel also has no positional asymmetry
    const massAsymSign = (mode === "cross" || syncDrive) ? 1 : Math.sign(massRight - massLeft);
    const skewSign     = dirSign * phaseSign * massAsymSign;

    const signedThrust = skewSign * sideThrust;
    const rawAngle     = skewSign * sideThrust * 2;

    setLateralForce(signedThrust);
    setBeamTwist(beamDispMm);
    setSkewAngle(clamp(rawAngle, -12, 12));

    if (sideThrust < 0.01) {
      setAffectedRail("none");
    } else if (signedThrust > 0) {
      setAffectedRail("left");
    } else {
      setAffectedRail("right");
    }
  }, [load, trolleyPos, accelMode, hasTieBack, beamKey, beamKeyCross, dir, weldSize, electrode, mode, hasVFD, vfdRamp, syncDrive]);

  const brakeTimer = useRef(null);

  const stopMove = () => {
    // Auto-brake: เบรคจับ 800ms แล้วค่อย Idle
    setAccelMode(3);
    if (brakeTimer.current) clearTimeout(brakeTimer.current);
    brakeTimer.current = setTimeout(() => setAccelMode(0), 800);
  };

  // Cleanup timer on unmount
  useEffect(() => () => clearTimeout(brakeTimer.current), []);

  // Thresholds use actual physical values (beamDispMm no longer 10× exaggerated)
  // Long Travel runway beam: ~L/500 = 5000/500 = 10mm is concern, use 3mm as warning
  // Cross Travel bridge girder: 23600/500 = 47mm, use 25mm as warning
  const isActive = accelMode > 0;

  const phaseLabel =
    accelMode === 0 ? "Idle" :
    accelMode === 3 ? "Braking" : "Accelerating";

  const phaseBadgeColor =
    accelMode === 0 ? { bg: "#eceff1", color: "#78909c" } :
    accelMode === 3 ? { bg: "#fff3e0", color: "#e65100" } :
    { bg: "#e3f2fd", color: "#0277bd" };

  // BITE/DRAG corner positions in SVG based on skew direction and travel direction
  // forward = top of SVG (y≈10), backward = bottom of SVG (y≈140)
  const fwdY = dir === "forward" ? 40 : 115;
  const rearY = dir === "forward" ? 115 : 40;
  const biteLeft = skewAngle > 0; // CW → left-forward bites
  const biteX = biteLeft ? 30 : 345;
  const dragX = biteLeft ? 345 : 30;

  const currentSections = mode === "long" ? BEAM_SECTIONS : BEAM_SECTIONS_CROSS;
  const currentBKey     = mode === "long" ? beamKey       : beamKeyCross;
  const sec             = currentSections[currentBKey];
  const e_display       = Math.round(sec.depth - sec.tf / 2 + RAIL_HEIGHT_MM);
  const weldColor       = weldUtil < 50 ? "#43a047" : weldUtil < 80 ? "#fb8c00" : "#e53935";
  // Visual rotation: use physical torsion angle scaled for visibility
  // Long Travel: phi_deg ~0.05-0.3° → scale ×8; Cross Travel: phi_deg ~1-3° → scale ×2
  const rotScale = mode === "long" ? 8 : 2;
  const dispSign = lateralForce > 0 ? 1 : lateralForce < 0 ? -1 : 0;
  const rotAngle = dispSign * Math.min(twistAngleDeg * rotScale, 3);
  const leftTilt       = affectedRail === "left"  ? rotAngle : 0;
  const rightTilt      = affectedRail === "right" ? rotAngle : 0;
  const leftWeldColor  = affectedRail === "left"  ? weldColor : "#43a047";
  const rightWeldColor = affectedRail === "right" ? weldColor : "#43a047";

  return (
    <div style={styles.container}>
      <h2 style={styles.header}>
        {mode === "long" ? "Long Travel Skew" : "Cross Travel Skew"} — 25 Ton Overhead Crane
      </h2>

      <div style={styles.mainGrid}>
      {/* ═══ LEFT PANEL — Controls ═══ */}
      <div style={styles.leftPanel}>

        {/* Mode Toggle */}
        <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: "2px solid #b0bec5", flexShrink: 0 }}>
          {[["long", "▶▶ Long Travel", "Crane along runway"], ["cross", "↔ Cross Travel", "Trolley along bridge"]].map(([m, label, sub]) => (
            <button key={m} type="button" onClick={() => setMode(m)} style={{
              flex: 1, padding: "8px 4px", border: "none", cursor: "pointer",
              fontWeight: "bold", fontSize: 12,
              backgroundColor: mode === m ? "#0277bd" : "#eceff1",
              color: mode === m ? "white" : "#546e7a",
              lineHeight: 1.3,
            }}>
              {label}<br/><span style={{ fontSize: 10, fontWeight: "normal" }}>{sub}</span>
            </button>
          ))}
        </div>

        {/* Load */}
        <div style={styles.inputGroup}>
          <div style={styles.label}>
            <span>Load</span>
            <span>{load} Ton</span>
          </div>
          <input
            aria-label="Load"
            type="range" min="0" max="30" value={load}
            onChange={(e) => setLoad(Number(e.target.value))}
            style={styles.slider}
          />
        </div>

        {/* Trolley Position — Long Travel only (affects runway beam load distribution) */}
        {mode === "long" && (
          <div style={styles.inputGroup}>
            <div style={styles.label}>
              <span>Trolley Position</span>
              <span>{trolleyPos.toFixed(1)} m (from left)</span>
            </div>
            <input
              aria-label="Trolley position"
              type="range" min="1" max={span - 1} step="0.5" value={trolleyPos}
              onChange={(e) => setTrolleyPos(Number(e.target.value))}
              style={styles.slider}
            />
            <div style={{ fontSize: 12, color: "#78909c", display: "flex", justifyContent: "space-between" }}>
              <span>Left Rail: Heavier</span>
              <span>Right Rail: Heavier</span>
            </div>
          </div>
        )}

        {/* Beam Section Selector */}
        <div style={styles.inputGroup}>
          <div style={styles.label}>
            <span>{mode === "long" ? "Runway Beam" : "Bridge Girder"}</span>
            <span style={{ color: "#00838f" }}>
              K = {calcKbeam(sec.Iy_cm4).toFixed(4)} ton/mm
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {Object.keys(currentSections).map((key) => {
              const active = currentBKey === key;
              return (
                <button key={key} type="button"
                  onClick={() => mode === "long" ? setBeamKey(key) : setBeamKeyCross(key)}
                  style={{
                    flex: 1, padding: "8px 6px", borderRadius: 8, border: "2px solid",
                    cursor: "pointer", fontWeight: "bold", fontSize: 12,
                    borderColor: active ? "#00838f" : "#b0bec5",
                    backgroundColor: active ? "#e0f2f1" : "#f5f5f5",
                    color: active ? "#00695c" : "#546e7a",
                  }}
                >
                  {key}
                  <div style={{ fontSize: 10, fontWeight: "normal", marginTop: 2 }}>
                    I_y = {currentSections[key].Iy_cm4.toLocaleString()} cm⁴
                  </div>
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: "#78909c", marginTop: 2 }}>
            {mode === "long" ? `Span ${BEAM_SPAN_MM/1000}m runway` : `Span ${BEAM_SPAN_CROSS_MM/1000}m bridge girder`}
          </div>
        </div>

        {/* Tie Back */}
        <div style={styles.inputGroup}>
          <div style={styles.label}>
            <span>Tie Back Status</span>
            <span>{hasTieBack ? "Locked" : "Unlocked"}</span>
          </div>
          <button
            type="button"
            onClick={() => setHasTieBack((v) => !v)}
            style={{
              padding: 10, borderRadius: 5, border: "none", cursor: "pointer",
              backgroundColor: hasTieBack ? "#66bb6a" : "#ef5350",
              color: "white", fontWeight: "bold", userSelect: "none",
            }}
          >
            {hasTieBack ? "Installed (Safer)" : "Not Installed (Risky)"}
          </button>
        </div>

        {/* Weld Settings */}
        <div style={styles.inputGroup}>
          <div style={styles.label}><span>Weld at Bottom Flange</span></div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: "#78909c", marginBottom: 4 }}>Fillet Weld Size</div>
              <select
                value={weldSize}
                onChange={(e) => setWeldSize(Number(e.target.value))}
                style={{ width: "100%", padding: "8px", borderRadius: 6, border: "1px solid #b0bec5", fontSize: 14 }}
              >
                {[6, 8, 10, 12].map(s => <option key={s} value={s}>{s} mm</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: "#78909c", marginBottom: 4 }}>Electrode</div>
              <select
                value={electrode}
                onChange={(e) => setElectrode(e.target.value)}
                style={{ width: "100%", padding: "8px", borderRadius: 6, border: "1px solid #b0bec5", fontSize: 14 }}
              >
                <option value="E6013">E6013 (τ=126 MPa)</option>
                <option value="E7016">E7016 (τ=144 MPa)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Direction + Action buttons */}
        <div style={{ textAlign: "center" }}>
          {/* Direction selector */}
          <div style={{ fontWeight: "bold", color: "#546e7a", fontSize: 13, marginBottom: 8 }}>
            Direction of Travel
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 16 }}>
            <button type="button" onClick={() => setDir("forward")} style={{
              ...styles.dirBtn,
              backgroundColor: dir === "forward" ? "#0288d1" : "#eceff1",
              color: dir === "forward" ? "white" : "#546e7a",
              borderColor: dir === "forward" ? "#0288d1" : "#b0bec5",
            }}>
              {mode === "long" ? "▶ Forward" : "▶ Right"}
            </button>
            <button type="button" onClick={() => setDir("backward")} style={{
              ...styles.dirBtn,
              backgroundColor: dir === "backward" ? "#0288d1" : "#eceff1",
              color: dir === "backward" ? "white" : "#546e7a",
              borderColor: dir === "backward" ? "#0288d1" : "#b0bec5",
            }}>
              {mode === "long" ? "◀ Backward" : "◀ Left"}
            </button>
          </div>

          {/* VFD / Inverter Control */}
          <div style={{ borderTop: "1px solid #eceff1", paddingTop: 10, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontWeight: "bold", fontSize: 13, color: "#37474f" }}>Inverter (VFD)</span>
              <button type="button" onClick={() => setHasVFD(v => !v)} style={{
                padding: "4px 14px", borderRadius: 20, border: "none", cursor: "pointer",
                fontWeight: "bold", fontSize: 12,
                backgroundColor: hasVFD ? "#00838f" : "#b0bec5",
                color: "white",
              }}>
                {hasVFD ? "ON" : "OFF"}
              </button>
            </div>
            {hasVFD && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#546e7a" }}>
                  <span>Ramp Time</span>
                  <span style={{ fontWeight: "bold", color: "#00838f" }}>{vfdRamp} s</span>
                </div>
                <input type="range" min="2" max="20" step="1" value={vfdRamp}
                  onChange={e => setVfdRamp(Number(e.target.value))}
                  style={styles.slider}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#90a4ae" }}>
                  <span>2s (aggressive)</span><span>10s</span><span>20s (gentle)</span>
                </div>
                {/* Sync drive only applies to Long Travel (2 end-truck motors) */}
                {mode === "long" && (
                  <button type="button" onClick={() => setSyncDrive(v => !v)} style={{
                    padding: "5px 10px", borderRadius: 6, border: `2px solid ${syncDrive ? "#43a047" : "#b0bec5"}`,
                    cursor: "pointer", fontWeight: "bold", fontSize: 11,
                    backgroundColor: syncDrive ? "#e8f5e9" : "#f5f5f5",
                    color: syncDrive ? "#2e7d32" : "#546e7a",
                  }}>
                    {syncDrive ? "✓ Synchronized Dual Drive" : "Single Drive (no sync)"}
                  </button>
                )}
                {mode === "cross" && (
                  <div style={{ fontSize: 11, color: "#78909c", fontStyle: "italic" }}>
                    Single motor (trolley) — ramp time controls accel only
                  </div>
                )}
              </div>
            )}
            {!hasVFD && (
              <div style={{ fontSize: 11, color: "#ef5350", backgroundColor: "#fff3e0", padding: "4px 8px", borderRadius: 6 }}>
                No VFD — Star-Delta start: T ≈ 1–1.5s (high accel)
              </div>
            )}
          </div>

          <div style={{ fontWeight: "bold", color: "#37474f", marginBottom: 10 }}>
            Hold to run · Release = Auto Brake
          </div>
          <div style={styles.btnGroup}>
            <button
              type="button"
              onPointerDown={() => setAccelMode(1)}
              onPointerUp={stopMove}
              onPointerCancel={stopMove}
              style={{ ...styles.btn, backgroundColor: accelMode === 1 ? "#0277bd" : "#29b6f6" }}
            >
              {mode === "long" ? "Speed 1 (15 m/min)" : "Speed 1 (10 m/min)"}
            </button>
            <button
              type="button"
              onPointerDown={() => setAccelMode(2)}
              onPointerUp={stopMove}
              onPointerCancel={stopMove}
              style={{ ...styles.btn, backgroundColor: accelMode === 2 ? "#b71c1c" : "#ef5350" }}
            >
              {mode === "long" ? "Speed 2 (30 m/min)" : "Speed 2 (20 m/min)"}
            </button>
          </div>
        </div>
      </div>{/* end leftPanel */}

      {/* ═══ RIGHT PANEL — Visualizations ═══ */}
      <div style={styles.rightPanel}>

      {/* Alerts — always rendered to prevent layout jump */}
      {(mode === "long" && isActive && Math.abs(trolleyPos - span / 2) > 5) ? (
        <div style={styles.skewAlert}>⚠ Warning: Unbalanced load — skew and flange grinding likely.</div>
      ) : (
        <div style={{ ...styles.skewAlert, backgroundColor: "#e8f5e9", color: "#388e3c", border: "1px solid #c8e6c9" }}>
          ✓ {mode === "long" ? "OK — Load balanced" : "Cross Travel mode — symmetric trolley load"}
        </div>
      )}

        {/* 3-card row: End Truck | Welded Base | Data Panel */}
        <div style={styles.vizRow}>

        {/* Combined Left + Right Support View */}
        <div style={styles.card}>
          <div style={{ fontWeight: "bold", color: "#37474f", marginBottom: 6, fontSize: 13, width: "100%", display: "flex", justifyContent: "space-between" }}>
            <span>{mode === "long" ? "Welded Base — Left & Right Runway" : "End Truck — Left & Right Bridge Girder"}</span>
            <span style={{ fontSize: 11, color: "#78909c" }}>{currentBKey} · e={e_display}mm</span>
          </div>
          <svg width="420" height="280" viewBox="0 0 420 280" style={{display:"block", flexShrink:0}}>
            <defs>
              <marker id="arr-thrust" markerWidth="7" markerHeight="5" refX="0" refY="2.5" orient="auto">
                <polygon points="0 0,7 2.5,0 5" fill="#c62828"/>
              </marker>
            </defs>

            {/* ── Reusable support template via <g transform="translate(cx,0)"> ── */}
            {/* LEFT SUPPORT — cx=90 */}
            {(() => {
              const cx = 90; const tilt = leftTilt; const wc = leftWeldColor;
              const ry = 205; // y of bottom of bottom flange (pivot)
              return (
                <g transform={`translate(${cx},0)`}>
                  {/* Column */}
                  <rect x="-32" y="218" width="64" height="58" fill="#90a4ae" rx="3"/>
                  <text x="0" y="253" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">{mode === "long" ? "L-COL" : "L-ET"}</text>
                  {/* Bearing plate */}
                  <rect x="-50" y="205" width="100" height="13" fill="#546e7a" rx="2"/>
                  {/* Fillet welds */}
                  <polygon points={`-50,205 -32,205 -50,191`} fill={wc} opacity="0.95"/>
                  <polygon points={`50,205 32,205 50,191`}     fill={wc} opacity="0.95"/>
                  {/* STATIC: Bottom flange */}
                  <rect x="-52" y="191" width="104" height="14" fill="#37474f" rx="2"/>
                  <text x="0" y="201" textAnchor="middle" fill="#cfd8dc" fontSize="6">WELDED</text>
                  {/* DYNAMIC: rotate about (0, ry) */}
                  <g transform={`rotate(${tilt}, 0, ${ry})`} style={{ transition: "transform 0.3s ease-out" }}>
                    <rect x="-8" y="70" width="16" height="121" fill="#546e7a"/>
                    <rect x="-52" y="57" width="104" height="13" fill="#37474f" rx="2"/>
                    <rect x="-18" y="33" width="36" height="24" fill="#e65100" rx="2"/>
                    <text x="0" y="48" textAnchor="middle" fill="white" fontSize="7">RAIL</text>
                    <ellipse cx="0" cy="20" rx="22" ry="9" fill="#b0bec5" stroke="#78909c" strokeWidth="2"/>
                    {hasTieBack && <line x1="-100" y1="63" x2="-52" y2="63" stroke="#43a047" strokeWidth="4"/>}
                  </g>
                  {/* Side thrust arrow (when left rail affected) */}
                  {isActive && affectedRail === "left" && (
                    <line x1="-75" y1="26" x2="-52" y2="26" stroke="#c62828" strokeWidth="2.5" markerEnd="url(#arr-thrust)"/>
                  )}
                  {/* Weld % label */}
                  {affectedRail === "left" && weldUtil > 0 && (
                    <text x="0" y="200" textAnchor="middle" fill={wc} fontSize="8" fontWeight="bold">{weldUtil.toFixed(0)}%</text>
                  )}
                  {/* Displacement label */}
                  {isActive && affectedRail === "left" && totalTopDisp > 0.2 && (
                    <text x={tilt > 0 ? 30 : -30} y="15" fill="#e91e63" fontSize="9" fontWeight="bold">{totalTopDisp.toFixed(1)}mm</text>
                  )}
                </g>
              );
            })()}

            {/* SPAN LINE */}
            <line x1="142" y1="26" x2="278" y2="26" stroke="#b0bec5" strokeWidth="1.5" strokeDasharray="6,3"/>
            <text x="210" y="22" textAnchor="middle" fill="#90a4ae" fontSize="9">
              {mode === "long" ? `SPAN ${BEAM_SPAN_MM/1000}m runway` : `SPAN ${BEAM_SPAN_CROSS_MM/1000}m bridge`}
            </text>

            {/* RIGHT SUPPORT — cx=330 */}
            {(() => {
              const cx = 330; const tilt = rightTilt; const wc = rightWeldColor;
              const ry = 205;
              return (
                <g transform={`translate(${cx},0)`}>
                  <rect x="-32" y="218" width="64" height="58" fill="#90a4ae" rx="3"/>
                  <text x="0" y="253" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">{mode === "long" ? "R-COL" : "R-ET"}</text>
                  <rect x="-50" y="205" width="100" height="13" fill="#546e7a" rx="2"/>
                  <polygon points={`-50,205 -32,205 -50,191`} fill={wc} opacity="0.95"/>
                  <polygon points={`50,205 32,205 50,191`}     fill={wc} opacity="0.95"/>
                  <rect x="-52" y="191" width="104" height="14" fill="#37474f" rx="2"/>
                  <text x="0" y="201" textAnchor="middle" fill="#cfd8dc" fontSize="6">WELDED</text>
                  <g transform={`rotate(${tilt}, 0, ${ry})`} style={{ transition: "transform 0.3s ease-out" }}>
                    <rect x="-8" y="70" width="16" height="121" fill="#546e7a"/>
                    <rect x="-52" y="57" width="104" height="13" fill="#37474f" rx="2"/>
                    <rect x="-18" y="33" width="36" height="24" fill="#e65100" rx="2"/>
                    <text x="0" y="48" textAnchor="middle" fill="white" fontSize="7">RAIL</text>
                    <ellipse cx="0" cy="20" rx="22" ry="9" fill="#b0bec5" stroke="#78909c" strokeWidth="2"/>
                    {hasTieBack && <line x1="52" y1="63" x2="100" y2="63" stroke="#43a047" strokeWidth="4"/>}
                  </g>
                  {isActive && affectedRail === "right" && (
                    <line x1="75" y1="26" x2="52" y2="26" stroke="#c62828" strokeWidth="2.5" markerEnd="url(#arr-thrust)"/>
                  )}
                  {affectedRail === "right" && weldUtil > 0 && (
                    <text x="0" y="200" textAnchor="middle" fill={wc} fontSize="8" fontWeight="bold">{weldUtil.toFixed(0)}%</text>
                  )}
                  {isActive && affectedRail === "right" && totalTopDisp > 0.2 && (
                    <text x={tilt > 0 ? 30 : -30} y="15" fill="#e91e63" fontSize="9" fontWeight="bold">{totalTopDisp.toFixed(1)}mm</text>
                  )}
                </g>
              );
            })()}

            {/* Ground line */}
            <line x1="30" y1="276" x2="390" y2="276" stroke="#90a4ae" strokeWidth="2"/>
          </svg>
          <div style={{ fontSize: 11, color: "#78909c" }}>
            {mode === "long"
              ? "Affected runway rail tilts inward · Weld % = utilization"
              : "Affected bridge girder tilts · End truck connection stress"}
          </div>
        </div>

        {/* Data Panel */}
        <div style={styles.card}>
          {/* Side Thrust */}
          <div style={{ width: "100%", marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "#78909c" }}>Side Thrust</div>
            <div style={{ fontSize: 28, fontWeight: "900", color: "#c62828" }}>
              {Math.abs(lateralForce).toFixed(2)}
              <span style={{ fontSize: 15 }}> Ton</span>
            </div>
            <div style={{ fontSize: 12, color: "#90a4ae" }}>
              {affectedRail === "left" ? "← Left rail (bites inward)" : affectedRail === "right" ? "→ Right rail (bites inward)" : "—"}
            </div>
            {/* VFD badge */}
            <div style={{ marginTop: 4, fontSize: 11, fontWeight: "bold",
              color: hasVFD ? "#00838f" : "#ef5350",
              backgroundColor: hasVFD ? "#e0f2f1" : "#fff3e0",
              padding: "2px 8px", borderRadius: 4, display: "inline-block" }}>
              {hasVFD
                ? `VFD ON · Ramp ${vfdRamp}s${syncDrive ? " · Sync" : ""}`
                : "No VFD · Star-Delta T≈1–1.5s"}
            </div>
          </div>

          {/* Lateral Bending */}
          <div style={{ width: "100%", marginBottom: 8, padding: "8px 10px", backgroundColor: "#f5f5f5", borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: "#78909c" }}>Lateral Bending (Beam)</div>
            <div style={{ fontSize: 22, fontWeight: "800", color: "#1565c0" }}>
              {beamTwist.toFixed(2)}
              <span style={{ fontSize: 13 }}> mm</span>
            </div>
          </div>

          {/* Torsion */}
          <div style={{ width: "100%", marginBottom: 8, padding: "8px 10px", backgroundColor: "#fff3e0", borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: "#78909c" }}>
              Torsion at Rail Top — {mode === "long" ? "Welded Base (4π²)" : "End Truck Bearing (π²)"}
              <span style={{ marginLeft: 6, color: "#e65100" }}>
                e = {e_display} mm
              </span>
            </div>
            <div style={{ fontSize: 22, fontWeight: "800", color: "#e65100" }}>
              {torsionDisp.toFixed(2)}
              <span style={{ fontSize: 13 }}> mm</span>
              <span style={{ fontSize: 13, color: "#90a4ae", marginLeft: 8 }}>
                φ = {twistAngleDeg.toFixed(3)}°
              </span>
            </div>
          </div>


          {!hasTieBack && (
            <div style={{ fontSize: 11, color: "#d32f2f" }}>
              No tie-back: Side thrust twists the structure.
            </div>
          )}
        </div>

        </div>{/* end vizRow */}

        {/* Weld Stress Card */}
        <div style={styles.card}>
          <div style={{ width: "100%", marginBottom: 10 }}>
            <div style={{ fontWeight: "bold", color: "#37474f", marginBottom: 6 }}>
              {mode === "long" ? "Weld Stress — Bottom Flange to Column Plate" : "End Connection Stress — Girder to End Truck"}
              <span style={{ fontSize: 12, fontWeight: "normal", color: "#78909c", marginLeft: 8 }}>
                {mode === "long" ? "Fillet" : "End plate fillet"} {weldSize}mm · {electrode} · τ_allow = {WELD_ALLOW[electrode]} MPa
              </span>
            </div>

            {/* Stress bar */}
            {(() => {
              const pct = Math.min(weldUtil, 150);
              const barColor = weldUtil < 50 ? "#43a047" : weldUtil < 80 ? "#fb8c00" : "#e53935";
              const fatigueRisk = weldUtil > 20 && !hasTieBack;
              return (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: "bold", color: barColor }}>
                      τ = {weldStress.toFixed(1)} MPa
                    </span>
                    <span style={{ fontSize: 13, fontWeight: "bold", color: barColor }}>
                      {weldUtil.toFixed(0)}% Utilization
                    </span>
                  </div>
                  <div style={{ width: "100%", height: 18, backgroundColor: "#eceff1", borderRadius: 9, overflow: "hidden" }}>
                    <div style={{
                      width: `${pct}%`, height: "100%", borderRadius: 9,
                      backgroundColor: barColor,
                      transition: "width 0.3s, background-color 0.3s",
                    }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#90a4ae", marginTop: 2 }}>
                    <span>0</span><span>50%</span><span>80%</span><span>100%</span>
                  </div>

                  {/* Status message — always one line, fixed height to prevent layout shift */}
                  <div style={{ marginTop: 8, minHeight: 28 }}>
                    {(() => {
                      if (weldUtil > 100)
                        return <span style={{ padding: "4px 10px", borderRadius: 6, backgroundColor: "#ffebee", color: "#c62828", fontSize: 12, fontWeight: "bold" }}>OVERSTRESSED — weld will fail</span>;
                      if (fatigueRisk)
                        return <span style={{ padding: "4px 10px", borderRadius: 6, backgroundColor: "#fff3e0", color: "#e65100", fontSize: 12, fontWeight: "bold" }}>FATIGUE RISK — cyclic loading without tie-back causes cracking</span>;
                      if (hasTieBack)
                        return <span style={{ padding: "4px 10px", borderRadius: 6, backgroundColor: "#e8f5e9", color: "#388e3c", fontSize: 12, fontWeight: "bold" }}>Tie-back installed — weld load reduced to {(calcKbeam(sec.Iy_cm4) / (calcKbeam(sec.Iy_cm4) + (mode === "long" ? K_TIEBACK_LONG : K_TIEBACK_CROSS)) * 100).toFixed(1)}%</span>;
                      return <span style={{ padding: "4px 10px", borderRadius: 6, backgroundColor: "#e8f5e9", color: "#388e3c", fontSize: 12, fontWeight: "bold" }}>PASS — static capacity OK</span>;
                    })()}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
        {/* Top View — bottom of right panel */}
        <div style={{ ...styles.card, backgroundColor: "#f5f5f5" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, width: "100%" }}>
            <span style={{ fontWeight: "bold", color: "#546e7a" }}>Top View — Skew (clamped ±12°)</span>
            <span style={{ ...styles.phaseBadge, backgroundColor: phaseBadgeColor.bg, color: phaseBadgeColor.color }}>
              {dir === "forward" ? "▶" : "◀"} {dir.charAt(0).toUpperCase() + dir.slice(1)} · {phaseLabel}
            </span>
          </div>
          <svg width="100%" height="140" viewBox="0 0 400 160" style={{display:"block"}}>
            <line x1="20" y1="10" x2="20" y2="150" stroke="#b0bec5" strokeWidth="6" />
            <line x1="380" y1="10" x2="380" y2="150" stroke="#b0bec5" strokeWidth="6" />
            <text x="20" y="8" textAnchor="middle" fill="#78909c" fontSize="10">L</text>
            <text x="380" y="8" textAnchor="middle" fill="#78909c" fontSize="10">R</text>
            <defs>
              <marker id="arrow-dir" markerWidth="8" markerHeight="6" refX="4" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#0288d1" />
              </marker>
              <marker id="arrow-red" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#c62828" />
              </marker>
            </defs>
            {dir === "forward"
              ? <line x1="200" y1="145" x2="200" y2="118" stroke="#0288d1" strokeWidth="2" markerEnd="url(#arrow-dir)" />
              : <line x1="200" y1="15"  x2="200" y2="42"  stroke="#0288d1" strokeWidth="2" markerEnd="url(#arrow-dir)" />
            }
            <g transform={`rotate(${skewAngle}, 200, 80)`}>
              <rect x="20" y="60" width="360" height="40" fill="#fbc02d" stroke="#f57f17" strokeWidth="2" rx="4" />
              <circle cx={20 + (trolleyPos / span) * 360} cy="80" r="12" fill="#d32f2f" />
              {isActive && Math.abs(skewAngle) > 0.1 && (
                <>
                  <circle cx={biteLeft ? 20 : 380} cy={fwdY < 60 ? 65 : 95} r="8"
                    fill="transparent" stroke="#c62828" strokeWidth="4" />
                  <text x={biteX} y={fwdY} fill="#c62828" fontSize="11" fontWeight="bold">BITE</text>
                  <text x={dragX} y={rearY} fill="#546e7a" fontSize="11" fontWeight="bold">DRAG</text>
                </>
              )}
            </g>
            {isActive && lateralForce > 0 && (
              <><line x1="380" y1="80" x2="410" y2="80" stroke="#c62828" strokeWidth="3" markerEnd="url(#arrow-red)" />
              <text x="385" y="73" fill="#c62828" fontSize="11">{Math.abs(lateralForce).toFixed(2)}T →R</text></>
            )}
            {isActive && lateralForce < 0 && (
              <><line x1="20" y1="80" x2="-10" y2="80" stroke="#c62828" strokeWidth="3" markerEnd="url(#arrow-red)" />
              <text x="5" y="73" fill="#c62828" fontSize="11">L← {Math.abs(lateralForce).toFixed(2)}T</text></>
            )}
          </svg>
          {isActive && affectedRail !== "none" && (
            <div style={{ fontSize: 12, color: "#c62828", marginTop: 4, fontWeight: "bold" }}>
              Side thrust pressing on {affectedRail.toUpperCase()} rail flange
            </div>
          )}
        </div>

      </div>{/* end rightPanel */}
      </div>{/* end mainGrid */}
    </div>
  );
};

export default CraneLongTravelSim;
