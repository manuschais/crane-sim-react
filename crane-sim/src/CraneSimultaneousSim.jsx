import React, { useState, useEffect } from "react";

// ── Constants (same physical values as CraneLongTravelSim) ─────────────────
const E_STEEL       = 200000; // N/mm²
const G_STEEL       = 80000;  // N/mm²
const RAIL_H        = 60;     // mm — SQT BAR height
const WELD_ALLOW    = { E6013: 126, E7016: 144 }; // MPa
const SPAN_LT       = 5000;   // mm — runway beam span
const SPAN_CT       = 23600;  // mm — bridge girder span
const K_TB_LT       = 24.2;   // ton/mm — tieback stiffness Long Travel
const K_TB_CT       = 0.5;    // ton/mm — tieback stiffness Cross Travel
const CRANE_MASS    = 20.8;   // ton
const TROLLEY_MASS  = 2.2;    // ton
const G_MS2         = 9.81;
const SQRT2         = Math.SQRT2;

const BEAM_LT = {
  "H600×300": { Iy_cm4: 9010,  depth: 588, tf: 20, tw: 12, b: 300, J_mm4: 1915755,  Cw_mm6: 7.259e12 },
  "H500×300": { Iy_cm4: 8110,  depth: 488, tf: 18, tw: 11, b: 300, J_mm4: 1366937,  Cw_mm6: 4.473e12 },
};
const BEAM_CT = {
  "H900×300": { Iy_cm4: 12629, depth: 900, tf: 28, tw: 16, b: 300, J_mm4: 5543509,  Cw_mm6: 2.394e13 },
  "H800×300": { Iy_cm4: 11717, depth: 800, tf: 26, tw: 14, b: 300, J_mm4: 4199637,  Cw_mm6: 1.717e13 },
};

// ── Physics helpers ────────────────────────────────────────────────────────
function kBeam(Iy_cm4, span_mm) {
  return (48 * E_STEEL * Iy_cm4 * 1e4) / (span_mm ** 3) / G_MS2; // ton/mm
}

function calcAccelG(mode, level, hasVFD, vfdRamp) {
  if (level === 0) return 0;
  const spd = mode === "lt"
    ? (level === 1 ? 15 / 60 : 30 / 60)
    : (level === 1 ? 10 / 60 : 20 / 60);
  const tNoVFD = mode === "lt"
    ? (level === 1 ? 1.5 : 1.0)
    : (level === 1 ? 1.0 : 0.8);
  const ramp = hasVFD ? vfdRamp : tNoVFD;
  return spd / ramp / G_MS2; // g units
}

function calcThrust(mode, load, trolleyPos, accelG, syncDrive) {
  const span = mode === "lt" ? 23.6 : 23.6; // (crane span for mass distribution)
  let massLeft, massRight;
  if (mode === "lt") {
    const total = load + TROLLEY_MASS;
    massLeft  = CRANE_MASS / 2 + total * (span - trolleyPos) / span;
    massRight = CRANE_MASS / 2 + total * trolleyPos / span;
  } else {
    const half = (load + TROLLEY_MASS) / 2;
    massLeft = massRight = half;
  }
  const inertiaDiff = (mode === "lt" && !syncDrive)
    ? Math.abs(massLeft - massRight) * accelG
    : 0;
  let thrust = inertiaDiff * 1.5;
  if (accelG > 0) {
    thrust += Math.max(massLeft, massRight) / 2 * 0.05;
    if (mode === "ct") thrust += (load + TROLLEY_MASS) * accelG * 0.1;
  }
  return thrust; // ton
}

function calcWeld(thrust, weldSize, electrode, pattern, weldOn, weldGap) {
  if (thrust <= 0) return { tau: 0, util: 0, fatUtil: 0 };
  const F_N   = thrust * G_MS2 * 1000; // N  (ton × 9810)
  const F_res = F_N * SQRT2;
  const a     = 0.707 * weldSize;
  const ratio = pattern === "continuous" ? 1.0 : weldOn / (weldOn + weldGap);
  const A     = 2 * RAIL_H * a * ratio;
  const tau   = F_res / A;
  const tFat  = pattern === "continuous" ? 55 : 18;
  return { tau, util: tau / WELD_ALLOW[electrode] * 100, fatUtil: tau / tFat * 100 };
}

function calcLife(tau, pattern, cyclesPerYear) {
  if (tau <= 0) return Infinity;
  const tFat = pattern === "continuous" ? 55 : 18;
  const C    = 2e6 * Math.pow(tFat, 3);
  return C / Math.pow(tau, 3) / cyclesPerYear; // years
}

// ── Styles ─────────────────────────────────────────────────────────────────
const S = {
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
    fontSize: "17px",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: "1px",
    flexShrink: 0,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "270px 300px 1fr",
    gap: "10px",
    flex: 1,
    overflow: "hidden",
    minHeight: 0,
  },
  panel: {
    backgroundColor: "white",
    padding: "12px",
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
  card: {
    backgroundColor: "white",
    padding: "12px",
    borderRadius: "14px",
    boxShadow: "0 4px 15px rgba(0,0,0,0.05)",
    display: "flex",
    flexDirection: "column",
  },
  label: {
    display: "flex",
    justifyContent: "space-between",
    fontWeight: "700",
    color: "#546e7a",
    fontSize: "13px",
    marginBottom: "4px",
  },
  slider: { width: "100%", accentColor: "#00838f", height: "6px", cursor: "pointer" },
  sectionTitle: {
    fontWeight: "800",
    fontSize: "12px",
    color: "white",
    padding: "4px 10px",
    borderRadius: "6px",
    marginBottom: "6px",
    letterSpacing: "0.5px",
  },
};

// ── Result row helper ──────────────────────────────────────────────────────
function ResultRow({ label, thrust, tau, util, fatUtil, life, color }) {
  const lifeStr = life >= 999 ? ">999" : life < 0.1 ? "<0.1" : life.toFixed(1);
  const bg = fatUtil > 100
    ? (life < 5 ? "#ffebee" : life < 20 ? "#fff3e0" : "#fff8e1")
    : "#e8f5e9";
  const textCol = fatUtil > 100
    ? (life < 5 ? "#c62828" : life < 20 ? "#e65100" : "#f57f17")
    : "#2e7d32";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "110px 70px 70px 70px 80px 1fr", gap: 6, alignItems: "center", padding: "6px 8px", borderRadius: 8, backgroundColor: bg, marginBottom: 4 }}>
      <span style={{ fontSize: 12, fontWeight: "bold", color }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: "900", color: "#c62828" }}>{thrust.toFixed(2)}<span style={{ fontSize: 10, color: "#90a4ae" }}> T</span></span>
      <span style={{ fontSize: 13, fontWeight: "800", color: "#37474f" }}>{tau.toFixed(1)}<span style={{ fontSize: 10, color: "#90a4ae" }}> MPa</span></span>
      <span style={{ fontSize: 13, fontWeight: "800", color: util > 100 ? "#c62828" : util > 80 ? "#fb8c00" : "#43a047" }}>{util.toFixed(0)}%</span>
      <span style={{ fontSize: 13, fontWeight: "800", color: textCol }}>{fatUtil.toFixed(0)}%</span>
      <span style={{ fontSize: 15, fontWeight: "900", color: textCol }}>{lifeStr}<span style={{ fontSize: 10, fontWeight: "normal", marginLeft: 3 }}>ปี</span></span>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function CraneSimultaneousSim() {
  // Shared inputs
  const [load,         setLoad]         = useState(8);
  const [trolleyPos,   setTrolleyPos]   = useState(3.0);
  const [hasTieBack,   setHasTieBack]   = useState(false);
  const [electrode,    setElectrode]    = useState("E7016");
  const [weldSize,     setWeldSize]     = useState(6);
  const [weldPattern,  setWeldPattern]  = useState("intermittent");
  const [weldOn,       setWeldOn]       = useState(50);
  const [weldGap,      setWeldGap]      = useState(500);
  const [cyclesPerYear, setCyclesPerYear] = useState(21000);

  // Long Travel inputs
  const [ltBeam,    setLtBeam]    = useState("H600×300");
  const [ltVFD,     setLtVFD]     = useState(false);
  const [ltRamp,    setLtRamp]    = useState(8);
  const [ltSync,    setLtSync]    = useState(false);
  const [ltLevel,   setLtLevel]   = useState(0); // 0=idle, 1=spd1, 2=spd2

  // Cross Travel inputs
  const [ctBeam,    setCtBeam]    = useState("H900×300");
  const [ctVFD,     setCtVFD]     = useState(false);
  const [ctRamp,    setCtRamp]    = useState(8);
  const [ctLevel,   setCtLevel]   = useState(0);

  // Results
  const [fLT,      setFLT]      = useState(0);
  const [fCT,      setFCT]      = useState(0);
  const [fComb,    setFComb]    = useState(0);
  const [wLT,      setWLT]      = useState({ tau: 0, util: 0, fatUtil: 0 });
  const [wCT,      setWCT]      = useState({ tau: 0, util: 0, fatUtil: 0 });
  const [wComb,    setWComb]    = useState({ tau: 0, util: 0, fatUtil: 0 });

  // Toggle helpers — click to activate, click same level again to stop
  const toggleLT = (lvl) => setLtLevel(v => v === lvl ? 0 : lvl);
  const toggleCT = (lvl) => setCtLevel(v => v === lvl ? 0 : lvl);

  // Physics
  useEffect(() => {
    const ltAccelG = calcAccelG("lt", Math.min(ltLevel, 2), ltVFD, ltRamp);
    const ctAccelG = calcAccelG("ct", Math.min(ctLevel, 2), ctVFD, ctRamp);

    const thrust_lt = calcThrust("lt", load, trolleyPos, ltAccelG, ltSync);
    const thrust_ct = calcThrust("ct", load, trolleyPos, ctAccelG, false);
    const thrust_cb = Math.sqrt(thrust_lt ** 2 + thrust_ct ** 2);

    setFLT(thrust_lt);
    setFCT(thrust_ct);
    setFComb(thrust_cb);

    setWLT(calcWeld(thrust_lt, weldSize, electrode, weldPattern, weldOn, weldGap));
    setWCT(calcWeld(thrust_ct, weldSize, electrode, weldPattern, weldOn, weldGap));
    setWComb(calcWeld(thrust_cb, weldSize, electrode, weldPattern, weldOn, weldGap));
  }, [load, trolleyPos, hasTieBack, electrode, weldSize, weldPattern, weldOn, weldGap,
      ltBeam, ltVFD, ltRamp, ltSync, ltLevel,
      ctBeam, ctVFD, ctRamp, ctLevel]);

  const lifeLT   = calcLife(wLT.tau,   weldPattern, cyclesPerYear);
  const lifeCT   = calcLife(wCT.tau,   weldPattern, cyclesPerYear);
  const lifeComb = calcLife(wComb.tau, weldPattern, cyclesPerYear);

  const ltActive = ltLevel > 0;
  const ctActive = ctLevel > 0;
  const bothActive = ltActive && ctActive;

  // Force diagram scale
  const maxF  = Math.max(fCT, fLT, fComb, 0.1);
  const scale = 120 / maxF; // px per ton (max arrow = 120px)
  const arrowLT   = Math.max(fLT  * scale, fLT  > 0.01 ? 10 : 0);
  const arrowCT   = Math.max(fCT  * scale, fCT  > 0.01 ? 10 : 0);
  const arrowComb = Math.max(fComb * scale, fComb > 0.01 ? 10 : 0);

  const btnBase = { padding: "10px 6px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: "bold", color: "white", flex: 1, userSelect: "none", touchAction: "manipulation" };

  return (
    <div style={S.container}>
      <h2 style={S.header}>
        Simultaneous Motion — Long Travel × Cross Travel · Combined Force on SQT BAR Weld
      </h2>

      <div style={S.grid}>

        {/* ═══ COL 1 — Shared inputs ═══ */}
        <div style={S.panel}>

          {/* Load */}
          <div>
            <div style={S.label}><span>Load</span><span>{load} Ton</span></div>
            <input type="range" min="0" max="30" value={load}
              onChange={e => setLoad(Number(e.target.value))} style={S.slider} />
          </div>

          {/* Trolley Position */}
          <div>
            <div style={S.label}><span>Trolley Position</span><span>{trolleyPos.toFixed(1)} m</span></div>
            <input type="range" min="1" max="22.6" step="0.5" value={trolleyPos}
              onChange={e => setTrolleyPos(Number(e.target.value))} style={S.slider} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#b0bec5" }}>
              <span>Left heavier</span><span>Right heavier</span>
            </div>
          </div>

          {/* Tie Back */}
          <div>
            <div style={S.label}><span>Tie Back</span><span>{hasTieBack ? "Locked" : "Unlocked"}</span></div>
            <button type="button" onClick={() => setHasTieBack(v => !v)} style={{
              width: "100%", padding: 10, borderRadius: 6, border: "none", cursor: "pointer",
              backgroundColor: hasTieBack ? "#66bb6a" : "#ef5350",
              color: "white", fontWeight: "bold",
            }}>
              {hasTieBack ? "Installed (Safer)" : "Not Installed (Risky)"}
            </button>
          </div>

          <div style={{ borderTop: "1px solid #eceff1", paddingTop: 8 }}>
            <div style={{ fontSize: 12, fontWeight: "bold", color: "#546e7a", marginBottom: 6 }}>SQT BAR Weld — 60×60 Rail → Top Flange</div>

            {/* Weld size + electrode */}
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "#78909c", marginBottom: 3 }}>Weld Size</div>
                <select value={weldSize} onChange={e => setWeldSize(Number(e.target.value))}
                  style={{ width: "100%", padding: "6px", borderRadius: 6, border: "1px solid #b0bec5", fontSize: 13 }}>
                  {[4, 5, 6, 8].map(s => <option key={s} value={s}>{s} mm</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "#78909c", marginBottom: 3 }}>Electrode</div>
                <select value={electrode} onChange={e => setElectrode(e.target.value)}
                  style={{ width: "100%", padding: "6px", borderRadius: 6, border: "1px solid #b0bec5", fontSize: 13 }}>
                  <option value="E6013">E6013 (126 MPa)</option>
                  <option value="E7016">E7016 (144 MPa)</option>
                </select>
              </div>
            </div>

            {/* Pattern */}
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              {["continuous", "intermittent"].map(p => (
                <button key={p} onClick={() => setWeldPattern(p)} style={{
                  flex: 1, padding: "6px 4px", borderRadius: 6, border: "1px solid #b0bec5", cursor: "pointer", fontSize: 11, fontWeight: "bold",
                  backgroundColor: weldPattern === p ? "#e65100" : "#f5f5f5",
                  color: weldPattern === p ? "white" : "#546e7a",
                }}>{p === "continuous" ? "Continuous" : "Intermittent"}</button>
              ))}
            </div>
            {weldPattern === "intermittent" && (
              <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: "#78909c", marginBottom: 2 }}>Weld (mm)</div>
                  <select value={weldOn} onChange={e => setWeldOn(Number(e.target.value))}
                    style={{ width: "100%", padding: "5px", borderRadius: 6, border: "1px solid #b0bec5", fontSize: 12 }}>
                    {[25, 40, 50, 75, 100].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: "#78909c", marginBottom: 2 }}>Gap (mm)</div>
                  <select value={weldGap} onChange={e => setWeldGap(Number(e.target.value))}
                    style={{ width: "100%", padding: "5px", borderRadius: 6, border: "1px solid #b0bec5", fontSize: 12 }}>
                    {[100, 150, 200, 250, 300, 400, 500].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
            )}
            {weldPattern === "intermittent" && (
              <div style={{ fontSize: 10, color: "#e65100" }}>
                Ratio {(weldOn / (weldOn + weldGap) * 100).toFixed(1)}% · Cat.E · τ_fat = 18 MPa
              </div>
            )}

            {/* Cycles/year */}
            <div style={{ marginTop: 10 }}>
              <div style={S.label}>
                <span style={{ fontSize: 11 }}>Cycles/year</span>
                <span style={{ fontSize: 11, fontWeight: "bold", color: "#37474f" }}>{cyclesPerYear.toLocaleString()}</span>
              </div>
              <input type="range" min="1000" max="100000" step="1000" value={cyclesPerYear}
                onChange={e => setCyclesPerYear(Number(e.target.value))} style={S.slider} />
            </div>
          </div>
        </div>

        {/* ═══ COL 2 — LT + CT settings ═══ */}
        <div style={S.panel}>

          {/* LONG TRAVEL */}
          <div>
            <div style={{ ...S.sectionTitle, backgroundColor: "#0277bd" }}>▶▶ LONG TRAVEL — Crane on Runway</div>

            {/* LT Beam */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: "#78909c", marginBottom: 4 }}>Runway Beam · Span 5 m</div>
              <div style={{ display: "flex", gap: 6 }}>
                {Object.keys(BEAM_LT).map(k => (
                  <button key={k} onClick={() => setLtBeam(k)} style={{
                    flex: 1, padding: "6px 4px", borderRadius: 6, border: "2px solid",
                    cursor: "pointer", fontWeight: "bold", fontSize: 11,
                    borderColor: ltBeam === k ? "#0277bd" : "#b0bec5",
                    backgroundColor: ltBeam === k ? "#e3f2fd" : "#f5f5f5",
                    color: ltBeam === k ? "#0277bd" : "#546e7a",
                  }}>{k}<div style={{ fontSize: 9, fontWeight: "normal" }}>Iy={BEAM_LT[k].Iy_cm4.toLocaleString()}</div></button>
                ))}
              </div>
            </div>

            {/* LT VFD */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: "bold", color: "#37474f" }}>VFD</span>
              <button onClick={() => setLtVFD(v => !v)} style={{
                padding: "3px 12px", borderRadius: 20, border: "none", cursor: "pointer",
                fontWeight: "bold", fontSize: 11,
                backgroundColor: ltVFD ? "#00838f" : "#b0bec5", color: "white",
              }}>{ltVFD ? "ON" : "OFF"}</button>
            </div>
            {ltVFD && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#546e7a", marginBottom: 2 }}>
                  <span>Ramp</span><span style={{ fontWeight: "bold", color: "#00838f" }}>{ltRamp} s</span>
                </div>
                <input type="range" min="2" max="20" step="1" value={ltRamp}
                  onChange={e => setLtRamp(Number(e.target.value))} style={{ ...S.slider, marginBottom: 4 }} />
                <button onClick={() => setLtSync(v => !v)} style={{
                  width: "100%", padding: "4px", borderRadius: 6, border: `2px solid ${ltSync ? "#43a047" : "#b0bec5"}`,
                  cursor: "pointer", fontWeight: "bold", fontSize: 10,
                  backgroundColor: ltSync ? "#e8f5e9" : "#f5f5f5",
                  color: ltSync ? "#2e7d32" : "#546e7a", marginBottom: 4,
                }}>{ltSync ? "✓ Sync Dual Drive" : "Single Drive"}</button>
              </>
            )}

            {/* LT Speed buttons — toggle on/off */}
            <div style={{ fontSize: 10, color: "#90a4ae", marginBottom: 3 }}>กดเปิด/ปิด (toggle)</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
              <button onClick={() => toggleLT(1)}
                style={{ ...btnBase, backgroundColor: ltLevel === 1 ? "#0277bd" : "#90caf9", boxShadow: ltLevel === 1 ? "0 0 0 3px #81d4fa" : "none" }}>
                Speed 1<br/><span style={{ fontSize: 10, fontWeight: "normal" }}>15 m/min</span>
              </button>
              <button onClick={() => toggleLT(2)}
                style={{ ...btnBase, backgroundColor: ltLevel === 2 ? "#b71c1c" : "#ef9a9a", boxShadow: ltLevel === 2 ? "0 0 0 3px #ffcdd2" : "none" }}>
                Speed 2<br/><span style={{ fontSize: 10, fontWeight: "normal" }}>30 m/min</span>
              </button>
            </div>
            <div style={{
              padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: "bold",
              backgroundColor: ltActive ? "#fff3e0" : "#eceff1",
              color: ltActive ? "#e65100" : "#90a4ae", textAlign: "center",
            }}>
              F_LT = {fLT.toFixed(3)} ton {ltActive ? "▶" : "(idle)"}
            </div>
          </div>

          <div style={{ borderTop: "1px solid #eceff1" }} />

          {/* CROSS TRAVEL */}
          <div>
            <div style={{ ...S.sectionTitle, backgroundColor: "#6a1b9a" }}>↔ CROSS TRAVEL — Trolley on Bridge</div>

            {/* CT Beam */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: "#78909c", marginBottom: 4 }}>Bridge Girder · Span 23.6 m</div>
              <div style={{ display: "flex", gap: 6 }}>
                {Object.keys(BEAM_CT).map(k => (
                  <button key={k} onClick={() => setCtBeam(k)} style={{
                    flex: 1, padding: "6px 4px", borderRadius: 6, border: "2px solid",
                    cursor: "pointer", fontWeight: "bold", fontSize: 11,
                    borderColor: ctBeam === k ? "#6a1b9a" : "#b0bec5",
                    backgroundColor: ctBeam === k ? "#f3e5f5" : "#f5f5f5",
                    color: ctBeam === k ? "#6a1b9a" : "#546e7a",
                  }}>{k}<div style={{ fontSize: 9, fontWeight: "normal" }}>Iy={BEAM_CT[k].Iy_cm4.toLocaleString()}</div></button>
                ))}
              </div>
            </div>

            {/* CT VFD */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: "bold", color: "#37474f" }}>VFD</span>
              <button onClick={() => setCtVFD(v => !v)} style={{
                padding: "3px 12px", borderRadius: 20, border: "none", cursor: "pointer",
                fontWeight: "bold", fontSize: 11,
                backgroundColor: ctVFD ? "#00838f" : "#b0bec5", color: "white",
              }}>{ctVFD ? "ON" : "OFF"}</button>
            </div>
            {ctVFD && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#546e7a", marginBottom: 2 }}>
                  <span>Ramp</span><span style={{ fontWeight: "bold", color: "#00838f" }}>{ctRamp} s</span>
                </div>
                <input type="range" min="2" max="20" step="1" value={ctRamp}
                  onChange={e => setCtRamp(Number(e.target.value))} style={{ ...S.slider, marginBottom: 4 }} />
              </>
            )}

            {/* CT Speed buttons — toggle on/off */}
            <div style={{ fontSize: 10, color: "#90a4ae", marginBottom: 3 }}>กดเปิด/ปิด (toggle)</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
              <button onClick={() => toggleCT(1)}
                style={{ ...btnBase, backgroundColor: ctLevel === 1 ? "#6a1b9a" : "#ce93d8", boxShadow: ctLevel === 1 ? "0 0 0 3px #e1bee7" : "none" }}>
                Speed 1<br/><span style={{ fontSize: 10, fontWeight: "normal" }}>10 m/min</span>
              </button>
              <button onClick={() => toggleCT(2)}
                style={{ ...btnBase, backgroundColor: ctLevel === 2 ? "#4a148c" : "#9c27b0", boxShadow: ctLevel === 2 ? "0 0 0 3px #d1c4e9" : "none" }}>
                Speed 2<br/><span style={{ fontSize: 10, fontWeight: "normal" }}>20 m/min</span>
              </button>
            </div>
            <div style={{
              padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: "bold",
              backgroundColor: ctActive ? "#f3e5f5" : "#eceff1",
              color: ctActive ? "#6a1b9a" : "#90a4ae", textAlign: "center",
            }}>
              F_CT = {fCT.toFixed(3)} ton {ctActive ? "↔" : "(idle)"}
            </div>
          </div>
        </div>

        {/* ═══ COL 3 — Visualization + Results ═══ */}
        <div style={S.rightPanel}>

          {/* Status bar */}
          <div style={{
            padding: "6px 14px", borderRadius: 10, fontWeight: "bold", fontSize: 13,
            backgroundColor: bothActive ? "#fff3e0" : ltActive || ctActive ? "#e3f2fd" : "#e8f5e9",
            color: bothActive ? "#e65100" : ltActive || ctActive ? "#0277bd" : "#388e3c",
            border: `1px solid ${bothActive ? "#ffcc80" : ltActive || ctActive ? "#90caf9" : "#c8e6c9"}`,
            flexShrink: 0,
          }}>
            {bothActive
              ? `⚠ Both axes active — F_combined = √(${fLT.toFixed(2)}² + ${fCT.toFixed(2)}²) = ${fComb.toFixed(2)} ton`
              : ltActive ? `▶▶ Long Travel active — F_LT = ${fLT.toFixed(3)} ton`
              : ctActive ? `↔ Cross Travel active — F_CT = ${fCT.toFixed(3)} ton`
              : "✓ Idle — กดปุ่ม Speed 1 / Speed 2 เพื่อเริ่ม simulation"}
          </div>

          {/* Force vector diagram + Comparison */}
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 10, flexShrink: 0 }}>

            {/* SVG Force diagram */}
            <div style={S.card}>
              <div style={{ fontWeight: "bold", color: "#37474f", fontSize: 12, marginBottom: 6 }}>
                Force Vector — Top View (Runway Rail)
              </div>
              <svg width="300" height="220" viewBox="0 0 300 220" style={{ display: "block" }}>
                <defs>
                  <marker id="arr-lt" markerWidth="7" markerHeight="5" refX="0" refY="2.5" orient="auto"><polygon points="0 0,7 2.5,0 5" fill="#0277bd"/></marker>
                  <marker id="arr-ct" markerWidth="7" markerHeight="5" refX="0" refY="2.5" orient="auto"><polygon points="0 0,7 2.5,0 5" fill="#6a1b9a"/></marker>
                  <marker id="arr-cb" markerWidth="7" markerHeight="5" refX="0" refY="2.5" orient="auto"><polygon points="0 0,7 2.5,0 5" fill="#e65100"/></marker>
                </defs>

                {/* Background */}
                <rect width="300" height="220" fill="#f8f9fa" rx="8"/>

                {/* ── Runway rails (horizontal) ── */}
                {/* Top rail (L) */}
                <rect x="6"  y="44" width="288" height="4"  fill="#ff8f00" rx="1" opacity="0.9"/>
                <rect x="6"  y="48" width="288" height="5"  fill="#455a64" rx="1"/>
                <rect x="6"  y="53" width="288" height="12" fill="#607d8b" rx="1"/>
                <rect x="6"  y="65" width="288" height="5"  fill="#455a64" rx="1"/>
                {/* Bottom rail (R) */}
                <rect x="6"  y="150" width="288" height="5"  fill="#455a64" rx="1"/>
                <rect x="6"  y="155" width="288" height="12" fill="#607d8b" rx="1"/>
                <rect x="6"  y="167" width="288" height="5"  fill="#455a64" rx="1"/>
                <rect x="6"  y="172" width="288" height="4"  fill="#ff8f00" rx="1" opacity="0.9"/>

                {/* Rail labels */}
                <text x="293" y="59"  fill="#546e7a" fontSize="9" fontWeight="bold">L</text>
                <text x="293" y="163" fill="#546e7a" fontSize="9" fontWeight="bold">R</text>
                <text x="8" y="42" fill="#ff8f00" fontSize="8" fontWeight="bold">◀ SQT BAR weld</text>

                {/* ── End trucks ── */}
                <rect x="30" y="63" width="24" height="74" fill="#263238" rx="3"/>
                <rect x="246" y="63" width="24" height="74" fill="#263238" rx="3"/>
                {/* ET labels */}
                <text x="42" y="101" textAnchor="middle" fill="#90a4ae" fontSize="7" fontWeight="bold">ET</text>
                <text x="258" y="101" textAnchor="middle" fill="#90a4ae" fontSize="7" fontWeight="bold">ET</text>

                {/* Wheels (4 corners) */}
                <circle cx="38"  cy="68"  r="6" fill="#1a237e" stroke="#e8eaf6" strokeWidth="1"/>
                <circle cx="38"  cy="132" r="6" fill="#1a237e" stroke="#e8eaf6" strokeWidth="1"/>
                <circle cx="262" cy="68"  r="6" fill="#1a237e" stroke="#e8eaf6" strokeWidth="1"/>
                <circle cx="262" cy="132" r="6" fill="#1a237e" stroke="#e8eaf6" strokeWidth="1"/>

                {/* ── Crane Bridge girder ── */}
                <rect x="52" y="74" width="196" height="52" fill="#fbc02d" stroke="#f57f17" strokeWidth="1.5" rx="3"/>
                {/* Bridge stiffener lines */}
                <line x1="100" y1="74" x2="100" y2="126" stroke="#f9a825" strokeWidth="0.8" opacity="0.6"/>
                <line x1="150" y1="74" x2="150" y2="126" stroke="#f9a825" strokeWidth="0.8" opacity="0.6"/>
                <line x1="200" y1="74" x2="200" y2="126" stroke="#f9a825" strokeWidth="0.8" opacity="0.6"/>
                <text x="150" y="104" textAnchor="middle" fill="#37474f" fontSize="10" fontWeight="bold">CRANE BRIDGE</text>

                {/* ── Trolley ── */}
                {(() => {
                  const tx = 52 + (trolleyPos / 22.6) * 196;
                  return (
                    <g>
                      <circle cx={tx} cy="100" r="11" fill="#d32f2f" stroke="#b71c1c" strokeWidth="1.5"/>
                      <circle cx={tx} cy="100" r="5"  fill="#ef9a9a" opacity="0.5"/>
                      <text x={tx} y="103" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">T</text>
                    </g>
                  );
                })()}

                {/* ── Force arrows (origin = bridge center) ── */}
                {fLT > 0.01 && (
                  <g>
                    <line x1="150" y1="100" x2={150 + arrowLT} y2="100"
                      stroke="#0277bd" strokeWidth="3.5" markerEnd="url(#arr-lt)"/>
                    <text x={153 + arrowLT} y="97" fill="#0277bd" fontSize="10" fontWeight="bold">
                      {fLT.toFixed(2)}T
                    </text>
                  </g>
                )}
                {fCT > 0.01 && (
                  <g>
                    <line x1="150" y1="100" x2="150" y2={100 + arrowCT}
                      stroke="#6a1b9a" strokeWidth="3.5" markerEnd="url(#arr-ct)"/>
                    <text x="154" y={100 + arrowCT + 12} fill="#6a1b9a" fontSize="10" fontWeight="bold">
                      {fCT.toFixed(2)}T
                    </text>
                  </g>
                )}
                {fComb > 0.01 && bothActive && (
                  <g>
                    <line x1="150" y1="100"
                      x2={150 + fLT / fComb * arrowComb}
                      y2={100 + fCT / fComb * arrowComb}
                      stroke="#e65100" strokeWidth="3" strokeDasharray="5,2" markerEnd="url(#arr-cb)"/>
                    <text x={152 + fLT / fComb * arrowComb}
                          y={98  + fCT / fComb * arrowComb + 14}
                      fill="#e65100" fontSize="10" fontWeight="bold">
                      {fComb.toFixed(2)}T
                    </text>
                  </g>
                )}

                {/* ── Legend ── */}
                <g transform="translate(6, 196)">
                  <rect width="8" height="8" fill="#0277bd" rx="1"/><text x="11" y="8" fill="#546e7a" fontSize="9">Long Travel</text>
                  <rect x="78" width="8" height="8" fill="#6a1b9a" rx="1"/><text x="89" y="8" fill="#546e7a" fontSize="9">Cross Travel</text>
                  <rect x="166" width="8" height="8" fill="#e65100" rx="1"/><text x="177" y="8" fill="#546e7a" fontSize="9">Combined</text>
                  <rect x="222" width="8" height="8" fill="#ff8f00" rx="1"/><text x="233" y="8" fill="#546e7a" fontSize="9">SQT BAR</text>
                </g>
              </svg>
            </div>

            {/* Comparison table */}
            <div style={S.card}>
              <div style={{ fontWeight: "bold", color: "#37474f", fontSize: 12, marginBottom: 8 }}>
                SQT BAR Weld — ผลกระทบต่อรางกันหลุด (Runway Rail)
              </div>
              {/* Column headers */}
              <div style={{ display: "grid", gridTemplateColumns: "110px 70px 70px 70px 80px 1fr", gap: 6, marginBottom: 4 }}>
                {["Scenario", "F (ton)", "τ (MPa)", "Static", "Fatigue", "อายุ"].map(h => (
                  <span key={h} style={{ fontSize: 10, color: "#90a4ae", fontWeight: "bold" }}>{h}</span>
                ))}
              </div>

              <ResultRow
                label="LT เดียว"
                thrust={fLT} tau={wLT.tau} util={wLT.util} fatUtil={wLT.fatUtil}
                life={lifeLT} color="#0277bd" />
              <ResultRow
                label="CT เดียว"
                thrust={fCT} tau={wCT.tau} util={wCT.util} fatUtil={wCT.fatUtil}
                life={lifeCT} color="#6a1b9a" />
              <ResultRow
                label="พร้อมกัน ⚡"
                thrust={fComb} tau={wComb.tau} util={wComb.util} fatUtil={wComb.fatUtil}
                life={lifeComb} color="#e65100" />

              {/* Increase badge */}
              {fLT > 0.01 && fCT > 0.01 && (
                <div style={{
                  marginTop: 8, padding: "8px 12px", borderRadius: 8,
                  backgroundColor: "#fff3e0", border: "1px solid #ffcc80",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span style={{ fontSize: 12, color: "#e65100", fontWeight: "bold" }}>
                    เชื่อมพร้อมกัน vs LT เดียว
                  </span>
                  <span style={{ fontSize: 18, fontWeight: "900", color: "#c62828" }}>
                    +{((fComb / fLT - 1) * 100).toFixed(0)}%
                    <span style={{ fontSize: 11, fontWeight: "normal", color: "#78909c", marginLeft: 4 }}>แรงที่แนวเชื่อม</span>
                  </span>
                </div>
              )}

              {/* Life comparison */}
              {fLT > 0.01 && fCT > 0.01 && lifeLT < 9999 && lifeComb < 9999 && (
                <div style={{
                  marginTop: 4, padding: "8px 12px", borderRadius: 8,
                  backgroundColor: "#ffebee", border: "1px solid #ffcdd2",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span style={{ fontSize: 12, color: "#c62828", fontWeight: "bold" }}>
                    อายุเชื่อมลดลง
                  </span>
                  <span style={{ fontSize: 14, fontWeight: "900", color: "#c62828" }}>
                    {lifeLT >= 999 ? ">999" : lifeLT.toFixed(1)} ปี → {lifeComb >= 999 ? ">999" : lifeComb.toFixed(1)} ปี
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Formula explanation */}
          <div style={{ ...S.card, backgroundColor: "#fafafa", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: "bold", color: "#546e7a", marginBottom: 4 }}>แรงรวม (Vector Sum)</div>
                <div style={{ fontFamily: "monospace", fontSize: 13, color: "#37474f", backgroundColor: "#eceff1", padding: "4px 10px", borderRadius: 6 }}>
                  F_comb = √(F_LT² + F_CT²)
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: "bold", color: "#546e7a", marginBottom: 4 }}>แรงที่แนวเชื่อม SQT BAR</div>
                <div style={{ fontFamily: "monospace", fontSize: 13, color: "#37474f", backgroundColor: "#eceff1", padding: "4px 10px", borderRadius: 6 }}>
                  F_res = F_comb × √2 &nbsp;(e = b = 60mm)
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: "bold", color: "#546e7a", marginBottom: 4 }}>S-N Fatigue Life</div>
                <div style={{ fontFamily: "monospace", fontSize: 13, color: "#37474f", backgroundColor: "#eceff1", padding: "4px 10px", borderRadius: 6 }}>
                  N = C/τ³ &nbsp;·&nbsp; ปี = N / cycles_per_year
                </div>
              </div>
            </div>
          </div>

        {/* Zone Recommendation */}
        {wComb.tau > 0 && (() => {
          const refTau = Math.max(wComb.tau, wLT.tau);
          const ratio  = weldPattern === "continuous" ? 1.0 : weldOn / (weldOn + weldGap);
          const A_cur  = 2 * RAIL_H * 0.707 * weldSize * ratio;
          const F_res_N = refTau * A_cur;
          const tauCont = F_res_N / (2 * RAIL_H * 0.707 * weldSize);
          const C_D = 2e6 * 55 ** 3;
          const C_E = 2e6 * 18 ** 3;
          const yrCur  = (weldPattern === "continuous" ? C_D : C_E) / refTau ** 3 / cyclesPerYear;
          const yrCrit = C_D / tauCont ** 3 / cyclesPerYear;
          const tau25  = (C_D / (25 * cyclesPerYear)) ** (1 / 3);
          const reqSize = Math.ceil(F_res_N / (2 * RAIL_H * 0.707 * tau25));
          const A_req  = 2 * RAIL_H * 0.707 * reqSize;
          const tauReq = F_res_N / A_req;
          const yrReq  = C_D / tauReq ** 3 / cyclesPerYear;
          const fmt = y => y >= 999 ? ">999" : y.toFixed(1);
          const yCol = y => y >= 25 ? "#2e7d32" : y >= 10 ? "#e65100" : "#c62828";
          const yBg  = y => y >= 25 ? "#e8f5e9" : y >= 10 ? "#fff3e0" : "#ffebee";
          const th = { padding: "5px 8px", textAlign: "center", color: "#546e7a", fontWeight: "700", fontSize: 11, borderBottom: "2px solid #eceff1" };
          const td = { padding: "6px 8px", textAlign: "center", fontSize: 12, borderBottom: "1px solid #f5f5f5" };
          const rows = [
            { label: "⚪ ปัจจุบัน",    desc: weldPattern === "continuous" ? "Continuous ทั้งเส้น" : `Intermittent ${weldOn}↔${weldGap}mm`, tau: refTau,  cat: weldPattern === "continuous" ? "D·55" : "E·18", years: yrCur  },
            { label: "🟡 Critical Zone", desc: `Continuous ${weldSize}mm (±3m จากจุดจอด)`,                                                     tau: tauCont, cat: "D·55",                                    years: yrCrit },
            { label: "🟢 Recommended",  desc: `Continuous ${reqSize}mm · E7016`,                                                                tau: tauReq,  cat: "D·55",                                    years: yrReq  },
          ];
          return (
            <div style={{ ...S.card, flexShrink: 0 }}>
              <div style={{ fontWeight: "bold", color: "#37474f", fontSize: 13, marginBottom: 8 }}>
                🗺 Weld Zone Recommendation — ใช้แรง Combined (worst case) · {cyclesPerYear.toLocaleString()} cycles/yr
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f5f5f5" }}>
                    {["Zone", "Pattern", "Cat.", "τ (MPa)", "Fatigue%", "อายุ (ปี)"].map(h => <th key={h} style={th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const lim  = r.cat.includes("55") ? 55 : 18;
                    const util = (r.tau / lim * 100).toFixed(0);
                    return (
                      <tr key={i} style={{ backgroundColor: yBg(r.years) }}>
                        <td style={{ ...td, textAlign: "left" }}>
                          <strong>{r.label}</strong>
                          <div style={{ fontSize: 10, color: "#78909c" }}>{r.desc}</div>
                        </td>
                        <td style={td}>{r.desc.split("(")[0].trim()}</td>
                        <td style={td}>{r.cat} MPa</td>
                        <td style={{ ...td, fontWeight: "bold" }}>{r.tau.toFixed(1)}</td>
                        <td style={{ ...td, fontWeight: "bold", color: yCol(r.years) }}>{util}%</td>
                        <td style={{ ...td, fontSize: 18, fontWeight: "900", color: yCol(r.years) }}>{fmt(r.years)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {yrCrit < 25 && (
                <div style={{ marginTop: 8, padding: "6px 12px", backgroundColor: "#fff8e1", borderRadius: 8, fontSize: 12, color: "#f57f17" }}>
                  💡 ต้องใช้ <strong>Continuous {reqSize}mm E7016</strong> ที่ Critical Zone ถึงจะได้อายุ ≥ 25 ปี
                </div>
              )}
            </div>
          );
        })()}

        </div>
      </div>
    </div>
  );
}
