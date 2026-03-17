import React, { useState, useEffect, useRef } from "react";

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const styles = {
  container: {
    fontFamily: "'Sarabun', sans-serif",
    padding: "16px",
    width: "100%",
    boxSizing: "border-box",
    backgroundColor: "#eceff1",
    minHeight: "100vh",
  },
  header: {
    textAlign: "center",
    color: "#37474f",
    marginBottom: "14px",
    fontSize: "22px",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: "1px",
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "340px 1fr",
    gap: "16px",
    alignItems: "start",
  },
  leftPanel: {
    backgroundColor: "white",
    padding: "18px",
    borderRadius: "14px",
    boxShadow: "0 4px 15px rgba(0,0,0,0.08)",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    position: "sticky",
    top: "16px",
  },
  rightPanel: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
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
  vizRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" },
  card: {
    backgroundColor: "white",
    padding: "16px",
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
const K_TIEBACK_ADDON = 24.2; // ton/mm — additional stiffness from tie-back rod
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
    const totalLoad = load + trolleyMass;
    const massLeft = craneMass / 2 + (totalLoad * (span - trolleyPos)) / span;
    const massRight = craneMass / 2 + (totalLoad * trolleyPos) / span;

    // Acceleration from real speed/ramp-time values
    const accel =
      accelMode === 1 ? ACCEL_SOFT  :
      accelMode === 2 ? ACCEL_HARD  :
      accelMode === 3 ? ACCEL_BRAKE : 0;

    const forceReqL = massLeft * accel;
    const forceReqR = massRight * accel;
    const inertiaDiff = Math.abs(forceReqL - forceReqR);

    let sideThrust = inertiaDiff * 1.5;
    if (accelMode > 0) {
      const vertWheelLoad = Math.max(massLeft, massRight) / 2;
      sideThrust += vertWheelLoad * 0.05;
    }

    // K from actual beam section + tie-back contribution
    const sec = BEAM_SECTIONS[beamKey];
    const kBeam = calcKbeam(sec.Iy_cm4);
    const kStiffness = hasTieBack ? kBeam + K_TIEBACK_ADDON : kBeam;
    const beamDispMm = (sideThrust / kStiffness) * 10;

    // --- Torsional calculation ---
    // Welded bottom flange → pivot at bottom flange centroid (not shear center)
    // e = bottom flange centroid → rail top
    const e_mm = sec.depth - sec.tf / 2 + RAIL_HEIGHT_MM;
    // Torsional moment (N·mm): side thrust ton → N × eccentricity
    const T_Nmm = sideThrust * 9810 * e_mm;
    // Welded plate = warping restrained at both ends → 4π² (not π²)
    const kTors = G_STEEL * sec.J_mm4 + 4 * Math.PI ** 2 * E_STEEL * sec.Cw_mm6 / BEAM_SPAN_MM ** 2;
    // φ (rad) — midspan concentrated torque, warping-fixed beam
    const phi_rad = (T_Nmm * BEAM_SPAN_MM) / (4 * kTors);
    const phi_deg = phi_rad * (180 / Math.PI);
    // Lateral shift at rail top from rotation (mm)
    const torsionDispMm = phi_rad * e_mm;
    const totalTopDispMm = beamDispMm + torsionDispMm;

    setTorsionDisp(torsionDispMm);
    setTotalTopDisp(totalTopDispMm);
    setTwistAngleDeg(phi_deg);

    // --- Weld stress at bottom flange connection ---
    // Tie-back takes a fraction of side thrust proportional to stiffness
    const kBeamOnly = calcKbeam(sec.Iy_cm4);
    const fractionToWeld = hasTieBack ? kBeamOnly / (kBeamOnly + K_TIEBACK_ADDON) : 1.0;
    const F_weld_N  = sideThrust * 9810 * fractionToWeld;
    // Moment component perpendicular to weld: F_M = T_weld / b_flange
    const F_M_N     = F_weld_N * e_mm / sec.b;
    const F_res_N   = Math.sqrt(F_weld_N ** 2 + F_M_N ** 2);
    const a_weld    = 0.707 * weldSize;          // throat (mm)
    const A_weld    = 2 * sec.b * a_weld;        // both sides of flange (mm²)
    const tau       = F_res_N / A_weld;           // MPa
    const tau_allow = WELD_ALLOW[electrode];
    setWeldStress(tau);
    setWeldUtil(tau / tau_allow * 100);

    // Direction and phase determine skew sign:
    // - forward=+1, backward=-1
    // - accelerating=+1, braking reverses inertia=-1
    // - heavier side (massLeft > massRight → left lags → CCW skew = negative in SVG)
    const dirSign = dir === "forward" ? 1 : -1;
    const phaseSign = accelMode === 3 ? -1 : 1;
    const massAsymSign = Math.sign(massRight - massLeft); // positive = right heavier → CW skew
    const skewSign = dirSign * phaseSign * massAsymSign;

    const signedThrust = skewSign * sideThrust;
    const rawAngle = skewSign * sideThrust * 2;

    setLateralForce(signedThrust);
    setBeamTwist(beamDispMm);
    setSkewAngle(clamp(rawAngle, -12, 12));

    // The rail that receives side thrust from flange contact
    if (sideThrust < 0.01) {
      setAffectedRail("none");
    } else if (signedThrust > 0) {
      setAffectedRail("right"); // CW skew pushes toward right rail
    } else {
      setAffectedRail("left");  // CCW skew pushes toward left rail
    }
  }, [load, trolleyPos, accelMode, hasTieBack, beamKey, dir, weldSize, electrode]);

  const brakeTimer = useRef(null);

  const stopMove = () => {
    // Auto-brake: เบรคจับ 800ms แล้วค่อย Idle
    setAccelMode(3);
    if (brakeTimer.current) clearTimeout(brakeTimer.current);
    brakeTimer.current = setTimeout(() => setAccelMode(0), 800);
  };

  // Cleanup timer on unmount
  useEffect(() => () => clearTimeout(brakeTimer.current), []);

  const isCritical = totalTopDisp > 6.0;
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

  const sec = BEAM_SECTIONS[beamKey];
  const e_display = Math.round(sec.depth - sec.tf / 2 + RAIL_HEIGHT_MM);
  const weldColor = weldUtil < 50 ? "#43a047" : weldUtil < 80 ? "#fb8c00" : "#e53935";
  // Visual rotation angle for End Truck / Welded Base SVG (pivot = bottom flange)
  const dispSign  = lateralForce > 0 ? 1 : lateralForce < 0 ? -1 : 0;
  const rotAngle  = dispSign * totalTopDisp * 1.5; // visual scale, not physical

  return (
    <div style={styles.container}>
      <h2 style={styles.header}>Long Travel Skew Simulation — 25 Ton Overhead Crane</h2>

      <div style={styles.mainGrid}>
      {/* ═══ LEFT PANEL — Controls ═══ */}
      <div style={styles.leftPanel}>
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

        {/* Trolley Position */}
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

        {/* Beam Section Selector */}
        <div style={styles.inputGroup}>
          <div style={styles.label}>
            <span>Runway Beam Section</span>
            <span style={{ color: "#00838f" }}>
              K = {calcKbeam(BEAM_SECTIONS[beamKey].Iy_cm4).toFixed(3)} ton/mm
            </span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {Object.keys(BEAM_SECTIONS).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setBeamKey(key)}
                style={{
                  flex: 1, padding: "10px 8px", borderRadius: 8, border: "2px solid",
                  cursor: "pointer", fontWeight: "bold", fontSize: 13,
                  borderColor: beamKey === key ? "#00838f" : "#b0bec5",
                  backgroundColor: beamKey === key ? "#e0f2f1" : "#f5f5f5",
                  color: beamKey === key ? "#00695c" : "#546e7a",
                }}
              >
                {key}
                <div style={{ fontSize: 11, fontWeight: "normal", marginTop: 2 }}>
                  I_y = {BEAM_SECTIONS[key].Iy_cm4.toLocaleString()} cm⁴
                </div>
              </button>
            ))}
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
            <button
              type="button"
              onClick={() => setDir("forward")}
              style={{
                ...styles.dirBtn,
                backgroundColor: dir === "forward" ? "#0288d1" : "#eceff1",
                color: dir === "forward" ? "white" : "#546e7a",
                borderColor: dir === "forward" ? "#0288d1" : "#b0bec5",
              }}
            >
              ▶ Forward
            </button>
            <button
              type="button"
              onClick={() => setDir("backward")}
              style={{
                ...styles.dirBtn,
                backgroundColor: dir === "backward" ? "#0288d1" : "#eceff1",
                color: dir === "backward" ? "white" : "#546e7a",
                borderColor: dir === "backward" ? "#0288d1" : "#b0bec5",
              }}
            >
              ◀ Backward
            </button>
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
              Speed 1 (15 m/min)
            </button>
            <button
              type="button"
              onPointerDown={() => setAccelMode(2)}
              onPointerUp={stopMove}
              onPointerCancel={stopMove}
              style={{ ...styles.btn, backgroundColor: accelMode === 2 ? "#b71c1c" : "#ef5350" }}
            >
              Speed 2 (30 m/min)
            </button>
          </div>
        </div>
      </div>{/* end leftPanel */}

      {/* ═══ RIGHT PANEL — Visualizations ═══ */}
      <div style={styles.rightPanel}>

      {/* Alerts */}
      {isActive && Math.abs(trolleyPos - span / 2) > 5 && (
        <div style={styles.skewAlert}>
          Warning: Unbalanced load — skew and flange grinding likely.
        </div>
      )}

        {/* 3-card row: End Truck | Welded Base | Data Panel */}
        <div style={styles.vizRow}>

        {/* End Truck View — pivot at welded bottom flange */}
        <div style={styles.card}>
          <div style={{ fontWeight: "bold", color: "#37474f", marginBottom: 6, fontSize: 13 }}>
            End Truck — {affectedRail === "none" ? "Idle" : `${affectedRail.toUpperCase()} Rail`}
          </div>
          <svg width="100%" viewBox="-110 -130 220 310">
            {/* Center reference line — static */}
            <line x1="0" y1="-120" x2="0" y2="90" stroke="#cfd8dc" strokeDasharray="4" strokeWidth="1"/>

            {/* STATIC: Column stub */}
            <rect x="-42" y="95" width="84" height="70" fill="#90a4ae" rx="3"/>
            <text x="0" y="138" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">COLUMN</text>

            {/* STATIC: Bearing Plate */}
            <rect x="-70" y="78" width="140" height="17" fill="#546e7a" rx="2"/>
            <text x="0" y="90" textAnchor="middle" fill="white" fontSize="8">Bearing Plate</text>

            {/* STATIC: Fillet welds — colored by stress */}
            <polygon points="-70,78 -50,78 -70,62" fill={weldColor} opacity="0.95"/>
            <polygon points="70,78 50,78 70,62" fill={weldColor} opacity="0.95"/>

            {/* STATIC: Bottom flange — welded, does NOT move */}
            <rect x="-70" y="62" width="140" height="16" fill="#37474f" rx="2"/>
            <text x="0" y="73" textAnchor="middle" fill="#cfd8dc" fontSize="7">WELDED</text>

            {/* DYNAMIC: Web + Top Flange + Rail — rotate about bottom of bottom flange (0,78) */}
            <g transform={`rotate(${rotAngle}, 0, 78)`}>
              {/* Web */}
              <rect x="-10" y="-52" width="20" height="114" fill="#546e7a"/>
              {/* Top flange */}
              <rect x="-70" y="-66" width="140" height="14" fill="#37474f" rx="2"/>
              {/* Rail (square bar) */}
              <rect x="-24" y="-93" width="48" height="27" fill="#e65100" rx="2"/>
              <text x="0" y="-78" textAnchor="middle" fill="white" fontSize="7">RAIL</text>
              {/* Wheel */}
              <ellipse cx="0" cy="-107" rx="26" ry="11" fill="#b0bec5" stroke="#78909c" strokeWidth="2"/>
              {/* Tie-back rod */}
              {hasTieBack && (
                <line x1="-110" y1="-59" x2="-70" y2="-59" stroke="#43a047" strokeWidth="5"/>
              )}
            </g>

            {/* Total displacement annotation */}
            {totalTopDisp > 0.2 && (
              <g>
                <line x1="0" y1="-120" x2={dispSign * Math.min(totalTopDisp * 7, 95)} y2="-120"
                  stroke="#e91e63" strokeWidth="2"/>
                <text x={dispSign * Math.min(totalTopDisp * 3.5, 47)} y="-124"
                  textAnchor="middle" fill="#e91e63" fontSize="10" fontWeight="bold">
                  {totalTopDisp.toFixed(1)} mm
                </text>
              </g>
            )}
          </svg>
          <div style={{ fontSize: 11, color: "#78909c" }}>Bottom Fixed · Top Swings</div>
        </div>

        {/* Welded Base View */}
        <div style={styles.card}>
          <div style={{ fontWeight: "bold", color: "#37474f", marginBottom: 6, fontSize: 13 }}>
            Welded Base Detail
          </div>
          <svg width="100%" viewBox="0 0 200 310" style={{ maxHeight: 260 }}>
            {/* Column */}
            <rect x="60" y="230" width="80" height="75" fill="#90a4ae" rx="3"/>
            <text x="100" y="275" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">COLUMN</text>

            {/* Bearing Plate */}
            <rect x="35" y="213" width="130" height="17" fill="#546e7a" rx="2"/>
            <text x="100" y="225" textAnchor="middle" fill="white" fontSize="9">Bearing Plate</text>

            {/* Fillet Welds — colored by stress */}
            <polygon points="35,213 55,213 35,196" fill={weldColor} opacity="0.9"/>
            <polygon points="165,213 145,213 165,196" fill={weldColor} opacity="0.9"/>
            <text x="100" y="209" textAnchor="middle" fill={weldColor} fontSize="9" fontWeight="bold">
              ▲ Weld {weldUtil.toFixed(0)}%
            </text>

            {/* STATIC: Bottom Flange — welded, does not move */}
            <rect x="28" y="183" width="144" height="13" fill="#37474f" rx="2"/>
            <text x="100" y="193" textAnchor="middle" fill="#cfd8dc" fontSize="7">WELDED</text>

            {/* DYNAMIC: Web + Top Flange + Rail — rotate about bottom of bottom flange (100,196) */}
            <g transform={`rotate(${rotAngle * 0.6}, 100, 196)`}>
            {/* Web */}
            <rect x="87" y={sec.depth > 540 ? 68 : 88} width="26"
              height={sec.depth > 540 ? 115 : 95} fill="#546e7a"/>

            {/* Top Flange */}
            <rect x="28" y={sec.depth > 540 ? 55 : 75} width="144" height="13" fill="#37474f" rx="2"/>

            {/* Rail (square bar 60mm) */}
            <rect x="76" y={sec.depth > 540 ? 30 : 50} width="48" height="25" fill="#e65100" rx="2"/>
            <text x="100" y={sec.depth > 540 ? 45 : 65} textAnchor="middle" fill="white" fontSize="8">RAIL</text>

            {/* Wheel */}
            <ellipse cx="100" cy={sec.depth > 540 ? 22 : 42} rx="22" ry="10" fill="#b0bec5" stroke="#78909c" strokeWidth="2"/>
            </g>{/* end dynamic */}

            {/* Side Thrust arrow */}
            <defs>
              <marker id="arr-red2" markerWidth="7" markerHeight="5" refX="0" refY="2.5" orient="auto">
                <polygon points="0 0,7 2.5,0 5" fill="#c62828"/>
              </marker>
            </defs>
            {isActive && lateralForce !== 0 && (
              <line
                x1={lateralForce > 0 ? 175 : 25}
                y1={sec.depth > 540 ? 37 : 57}
                x2={lateralForce > 0 ? 148 : 52}
                y2={sec.depth > 540 ? 37 : 57}
                stroke="#c62828" strokeWidth="2.5"
                markerEnd="url(#arr-red2)"
              />
            )}

            {/* e dimension line */}
            <line x1="18" y1="200" x2="18" y2={sec.depth > 540 ? 37 : 57}
              stroke="#e91e63" strokeWidth="1.5" strokeDasharray="4,3"/>
            <line x1="12" y1="200" x2="24" y2="200" stroke="#e91e63" strokeWidth="1.5"/>
            <line x1="12" y1={sec.depth > 540 ? 37 : 57}
              x2="24" y2={sec.depth > 540 ? 37 : 57} stroke="#e91e63" strokeWidth="1.5"/>
            <text x="8" y={(200 + (sec.depth > 540 ? 37 : 57)) / 2}
              textAnchor="middle" fill="#e91e63" fontSize="9" fontWeight="bold"
              transform={`rotate(-90,8,${(200 + (sec.depth > 540 ? 37 : 57)) / 2})`}>
              e={e_display}mm
            </text>

            {/* Tie-back rod */}
            {hasTieBack && (
              <>
                <line x1="28" y1={sec.depth > 540 ? 62 : 82} x2="0" y2={sec.depth > 540 ? 62 : 82}
                  stroke="#43a047" strokeWidth="4"/>
                <rect x="-4" y={sec.depth > 540 ? 56 : 76} width="4" height="12" fill="#43a047"/>
                <text x="14" y={sec.depth > 540 ? 55 : 75} fill="#43a047" fontSize="8" fontWeight="bold">TB</text>
              </>
            )}

            {/* Section label */}
            <text x="196" y="100" textAnchor="end" fill="#78909c" fontSize="9">{beamKey}</text>
          </svg>
          <div style={{ fontSize: 11, color: "#78909c" }}>Support at Column</div>
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
              {lateralForce > 0.01 ? "→ Right rail" : lateralForce < -0.01 ? "← Left rail" : "—"}
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
              Torsion at Rail Top — Welded Base
              <span style={{ marginLeft: 6, color: "#e65100" }}>
                e = {Math.round(BEAM_SECTIONS[beamKey].depth - BEAM_SECTIONS[beamKey].tf / 2 + RAIL_HEIGHT_MM)} mm
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

          {/* Total Top Displacement */}
          <div style={{ width: "100%", marginBottom: 12, padding: "8px 10px", backgroundColor: isCritical ? "#ffebee" : "#e8f5e9", borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: "#78909c" }}>Total Shift at Rail Top</div>
            <div style={{ fontSize: 28, fontWeight: "900", color: isCritical ? "#d32f2f" : "#2e7d32" }}>
              {totalTopDisp.toFixed(2)}
              <span style={{ fontSize: 15 }}> mm</span>
            </div>
            <div style={{ fontSize: 11, fontWeight: "bold", color: isCritical ? "#c62828" : "#388e3c" }}>
              {isCritical ? "DANGER: Severe rail & wheel wear" : "SAFE: Normal wear range"}
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
              Weld Stress — Bottom Flange to Column Plate
              <span style={{ fontSize: 12, fontWeight: "normal", color: "#78909c", marginLeft: 8 }}>
                Fillet {weldSize}mm · {electrode} · τ_allow = {WELD_ALLOW[electrode]} MPa
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

                  {/* Status messages */}
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    {weldUtil > 100 && (
                      <span style={{ padding: "4px 10px", borderRadius: 6, backgroundColor: "#ffebee", color: "#c62828", fontSize: 12, fontWeight: "bold" }}>
                        OVERSTRESSED — weld will fail
                      </span>
                    )}
                    {fatigueRisk && (
                      <span style={{ padding: "4px 10px", borderRadius: 6, backgroundColor: "#fff3e0", color: "#e65100", fontSize: 12, fontWeight: "bold" }}>
                        FATIGUE RISK — cyclic loading without tie-back causes cracking
                      </span>
                    )}
                    {hasTieBack && (
                      <span style={{ padding: "4px 10px", borderRadius: 6, backgroundColor: "#e8f5e9", color: "#388e3c", fontSize: 12, fontWeight: "bold" }}>
                        Tie-back installed — weld load reduced to {(calcKbeam(BEAM_SECTIONS[beamKey].Iy_cm4) / (calcKbeam(BEAM_SECTIONS[beamKey].Iy_cm4) + K_TIEBACK_ADDON) * 100).toFixed(1)}%
                      </span>
                    )}
                    {weldUtil <= 100 && weldUtil > 0 && !fatigueRisk && (
                      <span style={{ padding: "4px 10px", borderRadius: 6, backgroundColor: "#e8f5e9", color: "#388e3c", fontSize: 12, fontWeight: "bold" }}>
                        PASS — static capacity OK
                      </span>
                    )}
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
          <svg width="100%" height="160" viewBox="0 0 400 160">
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
