import React, { useState, useEffect } from "react";

const styles = {
  container: { fontFamily: "'Sarabun', sans-serif", padding: "20px", maxWidth: "1000px", margin: "0 auto", backgroundColor: "#f5f5f5", borderRadius: "16px", boxShadow: "0 10px 30px rgba(0,0,0,0.15)" },
  header: { textAlign: "center", color: "#37474f", marginBottom: "20px", fontSize: "26px", fontWeight: "800" },
  controlPanel: { backgroundColor: "white", padding: "25px", borderRadius: "16px", marginBottom: "20px", display: "grid", gap: "20px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" },
  inputGroup: { display: "flex", flexDirection: "column", gap: "5px" },
  label: { display: "flex", justifyContent: "space-between", fontWeight: "700", color: "#455a64", fontSize: "14px" },
  slider: { width: "100%", accentColor: "#00897b", cursor: "pointer", height: "8px" },
  btnGroup: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" },
  directionCol: { display: "flex", flexDirection: "column", gap: "10px", alignItems: "center", padding: "10px", backgroundColor: "#eceff1", borderRadius: "10px" },
  btn: { width: "100%", padding: "15px", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "16px", fontWeight: "bold", transition: "all 0.1s", boxShadow: "0 4px 0px rgba(0,0,0,0.1)", position: "relative" },
  dashboard: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" },
  monitor: { backgroundColor: "white", padding: "20px", borderRadius: "15px", boxShadow: "0 4px 10px rgba(0,0,0,0.05)", textAlign: "center", position: "relative" },
  valueGroup: { marginBottom: "15px" },
  valueLabel: { fontSize: "12px", color: "#78909c", textTransform: "uppercase", letterSpacing: "1px" },
  valueBig: { fontSize: "32px", fontWeight: "900", color: "#263238", lineHeight: "1.2" },
  resetBtn: { position: "absolute", top: "10px", right: "10px", background: "none", border: "1px solid #cfd8dc", borderRadius: "4px", cursor: "pointer", fontSize: "10px", color: "#78909c" }
};

const CranePeakHoldSim = () => {
  const beamHeight = 900;
  const trolleyMass = 2.2;

  const [load, setLoad] = useState(25);
  const [hasTieBack, setHasTieBack] = useState(false);
  const [activeBtn, setActiveBtn] = useState(0);

  const [displacement, setDisplacement] = useState(0);
  const [twistAngle, setTwistAngle] = useState(0);

  const [maxDisp, setMaxDisp] = useState(0);
  const [maxForce, setMaxForce] = useState(0);

  useEffect(() => {
    let gFactor = 0;
    if (Math.abs(activeBtn) === 1) gFactor = 0.02;
    if (Math.abs(activeBtn) === 2) gFactor = 0.06;

    if (activeBtn < 0) gFactor *= -1;

    const totalMass = load + trolleyMass;
    const currentForce = totalMass * gFactor;

    const stiffnessK = hasTieBack ? 25.0 : 0.8;

    let currentDisp = 0;
    if (currentForce !== 0) {
      const primaryDisp = (currentForce * 10) / stiffnessK;
      const pDelta = load * (Math.abs(primaryDisp) / beamHeight); // P-delta depends on actual displacement
      currentDisp = primaryDisp + (pDelta / stiffnessK) * Math.sign(currentForce);
    }

    setDisplacement(currentDisp);

    const angleRad = Math.atan(currentDisp / beamHeight);
    setTwistAngle(angleRad * (180 / Math.PI));

    setMaxDisp(prev => Math.max(prev, Math.abs(currentDisp)));
    setMaxForce(prev => Math.max(prev, Math.abs(currentForce)));

  }, [activeBtn, load, hasTieBack]);

  const resetMax = () => {
    setMaxDisp(0);
    setMaxForce(0);
  };

  const isDanger = maxDisp > 3.0;

  return (
    <div style={styles.container}>
      <h2 style={styles.header}>V7.0: Cross Travel Skew</h2>

      <div style={styles.controlPanel}>
        <div style={styles.inputGroup}>
          <div style={styles.label}><span>Load</span><span>{load} Ton</span></div>
          <input aria-label="Load" type="range" min="0" max="30" value={load} onChange={e => setLoad(Number(e.target.value))} style={styles.slider} />
        </div>

        <div style={styles.inputGroup}>
          <div style={styles.label}><span>Tie Back</span><span>{hasTieBack ? "Installed" : "Not Installed"}</span></div>
          <button
            onClick={() => setHasTieBack(!hasTieBack)}
            style={{ padding: "10px", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: "bold", backgroundColor: hasTieBack ? "#66bb6a" : "#ef5350", color: "white" }}
          >
            {hasTieBack ? "LOCKED (SAFE)" : "UNLOCKED (RISK)"}
          </button>
        </div>

        <div style={{ textAlign: "center", fontWeight: "bold", color: "#37474f", marginTop: "10px" }}>Direction Control (press and hold)</div>
        <div style={styles.btnGroup}>
          <div style={styles.directionCol}>
            <div style={{ fontSize: "12px", fontWeight: "bold", color: "#546e7a" }}>Move Left</div>
            <button
              onMouseDown={() => setActiveBtn(-1)} onMouseUp={() => setActiveBtn(0)}
              onTouchStart={() => setActiveBtn(-1)} onTouchEnd={() => setActiveBtn(0)}
              style={{ ...styles.btn, backgroundColor: "#81d4fa" }}
            >
              Speed 1 (Soft)
            </button>
            <button
              onMouseDown={() => setActiveBtn(-2)} onMouseUp={() => setActiveBtn(0)}
              onTouchStart={() => setActiveBtn(-2)} onTouchEnd={() => setActiveBtn(0)}
              style={{ ...styles.btn, backgroundColor: "#29b6f6", color: "white" }}
            >
              Speed 2 (Fast)
            </button>
          </div>

          <div style={styles.directionCol}>
            <div style={{ fontSize: "12px", fontWeight: "bold", color: "#546e7a" }}>Move Right</div>
            <button
              onMouseDown={() => setActiveBtn(1)} onMouseUp={() => setActiveBtn(0)}
              onTouchStart={() => setActiveBtn(1)} onTouchEnd={() => setActiveBtn(0)}
              style={{ ...styles.btn, backgroundColor: "#81d4fa" }}
            >
              Speed 1 (Soft)
            </button>
            <button
              onMouseDown={() => setActiveBtn(2)} onMouseUp={() => setActiveBtn(0)}
              onTouchStart={() => setActiveBtn(2)} onTouchEnd={() => setActiveBtn(0)}
              style={{ ...styles.btn, backgroundColor: "#29b6f6", color: "white" }}
            >
              Speed 2 (Fast)
            </button>
          </div>
        </div>
      </div>

      <div style={styles.dashboard}>
        <div style={styles.monitor}>
          <svg width="200" height="250" viewBox="-100 -125 200 250">
            <line x1="0" y1="-100" x2="0" y2="100" stroke="#cfd8dc" strokeDasharray="4" />
            <g transform={`rotate(${twistAngle}, 0, 100)`}>
              <rect x="-30" y="-100" width="60" height="15" fill="#37474f" rx="2" />
              <rect x="-30" y="85" width="60" height="15" fill="#37474f" rx="2" />
              <rect x="-8" y="-85" width="16" height="170" fill="#546e7a" />
              <rect x="-8" y="-115" width="16" height="15" fill="#e65100" />
            </g>
            {Math.abs(displacement) > 0.1 && (
              <g>
                <line x1="0" y1="-130" x2={displacement * 3} y2="-130" stroke="#e91e63" strokeWidth="2" />
                <text x={displacement * 1.5} y="-140" textAnchor="middle" fill="#e91e63" fontSize="12" fontWeight="bold">
                  {Math.abs(displacement).toFixed(1)} mm
                </text>
              </g>
            )}
          </svg>
          <div style={{ position: "absolute", bottom: 10, left: 0, width: "100%", fontSize: "12px", color: "#78909c" }}>
            Real-time: {Math.abs(displacement).toFixed(1)} mm
          </div>
        </div>

        <div style={styles.monitor}>
          <button style={styles.resetBtn} onClick={resetMax}>RESET MAX</button>

          <div style={styles.valueGroup}>
            <div style={styles.valueLabel}>Max Shift</div>
            <div style={styles.valueBig}>{maxDisp.toFixed(2)} <span style={{ fontSize: "16px", color: "#b0bec5" }}>mm</span></div>
            <div style={{ fontSize: "12px", color: isDanger ? "#e53935" : "#43a047" }}>
              {isDanger ? "Over limit (3mm)" : "Within normal range"}
            </div>
          </div>

          <hr style={{ border: "0", borderTop: "1px solid #eceff1", margin: "20px 0" }} />

          <div style={styles.valueGroup}>
            <div style={styles.valueLabel}>Max Side Force</div>
            <div style={{ ...styles.valueBig, color: "#0277bd" }}>{maxForce.toFixed(2)} <span style={{ fontSize: "16px", color: "#b0bec5" }}>Ton</span></div>
            <div style={{ fontSize: "12px", color: "#78909c" }}>Shear at welded joints</div>
          </div>

          {!hasTieBack && (
            <div style={{ marginTop: "15px", padding: "10px", backgroundColor: "#ffebee", color: "#c62828", fontSize: "12px", borderRadius: "8px" }}>
              <b>Warning:</b> No tie-back + Speed 2
              <br />
              can create high stress at welded connections.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CranePeakHoldSim;