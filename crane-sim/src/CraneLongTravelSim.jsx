import React, { useState, useEffect } from "react";

// --- Helpers ---
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// --- Styles ---
const styles = {
  container: {
    fontFamily: "'Sarabun', sans-serif",
    padding: "20px",
    maxWidth: "1000px",
    margin: "0 auto",
    backgroundColor: "#eceff1",
    borderRadius: "16px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
  },
  header: {
    textAlign: "center",
    color: "#37474f",
    marginBottom: "20px",
    fontSize: "28px",
    fontWeight: "800",
    textTransform: "uppercase",
  },
  controlPanel: {
    backgroundColor: "white",
    padding: "25px",
    borderRadius: "16px",
    marginBottom: "20px",
    display: "grid",
    gap: "20px",
  },
  inputGroup: { display: "flex", flexDirection: "column", gap: "8px" },
  label: {
    display: "flex",
    justifyContent: "space-between",
    fontWeight: "700",
    color: "#546e7a",
    fontSize: "14px",
  },
  slider: { width: "100%", accentColor: "#00838f", height: "8px", cursor: "pointer" },

  // Simulation Area
  vizContainer: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" },
  card: {
    backgroundColor: "white",
    padding: "20px",
    borderRadius: "16px",
    boxShadow: "0 4px 15px rgba(0,0,0,0.05)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },

  // Buttons
  btnGroup: { display: "flex", gap: "15px", justifyContent: "center", marginTop: "10px" },
  btn: {
    padding: "15px 30px",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: "bold",
    transition: "all 0.1s",
    color: "white",
    boxShadow: "0 4px 0 rgba(0,0,0,0.1)",
    userSelect: "none",
    touchAction: "manipulation",
  },

  // Skew Alert
  skewAlert: {
    gridColumn: "1 / -1",
    backgroundColor: "#ffebee",
    color: "#c62828",
    padding: "10px",
    borderRadius: "8px",
    textAlign: "center",
    fontWeight: "bold",
    border: "1px solid #ffcdd2",
  },
};

const CraneLongTravelSim = () => {
  // --- Constants (note: this is a visualization model, not strict SI-force) ---
  const span = 23.6; // m
  const craneMass = 20.8; // Ton
  const trolleyMass = 2.2; // Ton

  // --- Inputs ---
  const [load, setLoad] = useState(25); // Ton
  const [trolleyPos, setTrolleyPos] = useState(3.0); // m (from left)
  const [hasTieBack, setHasTieBack] = useState(false);
  const [accelMode, setAccelMode] = useState(0); // 0=Stop, 1=Soft, 2=Hard

  // --- Results ---
  const [skewAngle, setSkewAngle] = useState(0); // deg (visual, clamped)
  const [lateralForce, setLateralForce] = useState(0); // Ton (side thrust index)
  const [beamTwist, setBeamTwist] = useState(0); // mm (visual displacement index)
  const [wheelWear, setWheelWear] = useState(0); // Wear Index (not displayed but kept)

  useEffect(() => {
    // 1) Mass Distribution (Left vs Right)
    const totalLoad = load + trolleyMass;
    const massLeft = craneMass / 2 + (totalLoad * (span - trolleyPos)) / span;
    const massRight = craneMass / 2 + (totalLoad * trolleyPos) / span;

    // 2) Acceleration Mode (m/s^2) — used as a "driver input" for the visualization
    const accel = accelMode === 1 ? 0.2 : accelMode === 2 ? 0.6 : 0;

    // Force-like index required to move each side
    const forceReqL = massLeft * accel;
    const forceReqR = massRight * accel;

    // 3) Skew effect (difference drives side thrust)
    const inertiaDiff = Math.abs(forceReqL - forceReqR);

    // 15–20% + biting factor (visual)
    let sideThrust = inertiaDiff * 1.5;

    // add dynamic wander baseline when moving
    if (accelMode > 0) {
      const vertWheelLoad = massLeft / 2; // assume 2 wheels on heavy side
      sideThrust += vertWheelLoad * 0.05;
    }

    // 4) Beam twist (stiffness model)
    const kStiffness = hasTieBack ? 25.0 : 0.8; // T/mm (visual stiffness)
    const beamDispMm = (sideThrust / kStiffness) * 10; // scale for visualization

    // 5) Wear index
    const wearIdx = sideThrust * (accelMode === 2 ? 3 : 1) * 10;

    // --- Apply results ---
    setLateralForce(sideThrust);
    setBeamTwist(beamDispMm);
    setWheelWear(wearIdx);

    // --- Visual skew angle: clamp so SVG won't spin wildly ---
    const rawAngle = sideThrust * 2; // deg
    setSkewAngle(clamp(rawAngle, -12, 12)); // clamp to ±12°
  }, [load, trolleyPos, accelMode, hasTieBack]);

  // NOTE: this threshold is a visual limit for "danger" highlight
  const isCritical = beamTwist > 4.0;

  // --- Pointer handlers (works for mouse + touch + pen) ---
  const startSoft = () => setAccelMode(1);
  const startHard = () => setAccelMode(2);
  const stopMove = () => setAccelMode(0);

  return (
    <div style={styles.container}>
      <h2 style={styles.header}>🚆 V8.1: จำลองการออกตัวรางยาว (Long Travel Skew)</h2>

      <div style={styles.controlPanel}>
        <div style={styles.inputGroup}>
          <div style={styles.label}>
            <span>น้ำหนักยก (Load)</span>
            <span>{load} Ton</span>
          </div>
          <input
            aria-label="Load"
            type="range"
            min="0"
            max="30"
            value={load}
            onChange={(e) => setLoad(Number(e.target.value))}
            style={styles.slider}
          />
        </div>

        <div style={styles.inputGroup}>
          <div style={styles.label}>
            <span>ตำแหน่งรอก (Trolley Position)</span>
            <span>{trolleyPos.toFixed(1)} m (จากซ้าย)</span>
          </div>
          <input
            aria-label="Trolley position"
            type="range"
            min="1"
            max={span - 1}
            step="0.5"
            value={trolleyPos}
            onChange={(e) => setTrolleyPos(Number(e.target.value))}
            style={styles.slider}
          />
          <div style={{ fontSize: 12, color: "#78909c", display: "flex", justifyContent: "space-between" }}>
            <span>⬅️ หนัก (Heavy)</span>
            <span>เบา (Light) ➡️</span>
          </div>
        </div>

        <div style={styles.inputGroup}>
          <div style={styles.label}>
            <span>Tie Back Status</span>
            <span>{hasTieBack ? "✅ LOCKED" : "❌ UNLOCKED"}</span>
          </div>
          <button
            type="button"
            onClick={() => setHasTieBack((v) => !v)}
            style={{
              padding: 10,
              borderRadius: 5,
              border: "none",
              cursor: "pointer",
              backgroundColor: hasTieBack ? "#66bb6a" : "#ef5350",
              color: "white",
              fontWeight: "bold",
              userSelect: "none",
              touchAction: "manipulation",
            }}
          >
            {hasTieBack ? "ติดตั้งแล้ว (ปลอดภัย)" : "ไม่มี (คานบิด)"}
          </button>
        </div>

        <div style={{ textAlign: "center", marginTop: 10 }}>
          <div style={{ fontWeight: "bold", color: "#37474f", marginBottom: 10 }}>
            🎮 กดค้างเพื่อออกตัว (รองรับมือถือด้วย)
          </div>

          <div style={styles.btnGroup}>
            <button
              type="button"
              onPointerDown={startSoft}
              onPointerUp={stopMove}
              onPointerCancel={stopMove}
              onPointerLeave={stopMove}
              style={{ ...styles.btn, backgroundColor: "#29b6f6" }}
            >
              Soft Start (Speed 1)
            </button>

            <button
              type="button"
              onPointerDown={startHard}
              onPointerUp={stopMove}
              onPointerCancel={stopMove}
              onPointerLeave={stopMove}
              style={{ ...styles.btn, backgroundColor: "#ef5350" }}
            >
              Hard Start (Speed 2) 🚀
            </button>
          </div>
        </div>
      </div>

      {accelMode > 0 && Math.abs(trolleyPos - span / 2) > 5 && (
        <div style={styles.skewAlert}>⚠️ คำเตือน: น้ำหนักไม่สมดุล! เครนกำลังวิ่งเป๋ (Skewing) ทำให้ล้อกินราง!</div>
      )}

      <div style={styles.vizContainer}>
        {/* TOP VIEW: CRANE SKEW */}
        <div style={{ ...styles.card, gridColumn: "1 / -1", backgroundColor: "#f5f5f5" }}>
          <div style={{ fontWeight: "bold", color: "#546e7a", marginBottom: 10 }}>
            มุมมองด้านบน (Top View): อาการวิ่งเป๋ (มุมจำกัดไว้ ±12°)
          </div>

          <svg width="100%" height="150" viewBox="0 0 400 150">
            {/* Rails */}
            <line x1="20" y1="10" x2="20" y2="140" stroke="#b0bec5" strokeWidth="6" />
            <line x1="380" y1="10" x2="380" y2="140" stroke="#b0bec5" strokeWidth="6" />

            {/* Crane Bridge (Rotated by Skew) */}
            <g transform={`rotate(${skewAngle}, 200, 75)`}>
              <rect x="20" y="55" width="360" height="40" fill="#fbc02d" stroke="#f57f17" strokeWidth="2" rx="4" />
              {/* Trolley Load */}
              <circle cx={20 + (trolleyPos / span) * 360} cy="75" r="12" fill="#d32f2f" />

              {/* Wheels Grinding */}
              {accelMode > 0 && (
                <g>
                  {/* Left Wheel Biting */}
                  <circle cx="20" cy="75" r="8" fill="transparent" stroke="#c62828" strokeWidth="4" />
                  <text x="35" y="45" fill="#c62828" fontSize="12" fontWeight="bold">
                    BITE!
                  </text>
                  {/* Right Wheel Dragging */}
                  <text x="340" y="115" fill="#c62828" fontSize="12" fontWeight="bold">
                    DRAG!
                  </text>
                </g>
              )}
            </g>

            {/* Force Vectors */}
            {accelMode > 0 && (
              <g>
                <line x1="20" y1="75" x2="50" y2="75" stroke="#c62828" strokeWidth="3" markerEnd="url(#arrow-red)" />
                <text x="60" y="80" fill="#c62828" fontSize="12">
                  Side Thrust {lateralForce.toFixed(2)}T
                </text>
              </g>
            )}

            <defs>
              <marker id="arrow-red" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#c62828" />
              </marker>
            </defs>
          </svg>
        </div>

        {/* LEFT CARD: RAIL CROSS SECTION */}
        <div style={styles.card}>
          <div style={{ fontWeight: "bold", color: "#37474f" }}>ผลกระทบต่อรางฝั่งซ้าย (Heavy Side)</div>

          <svg width="200" height="200" viewBox="-100 -100 200 200">
            <line x1="0" y1="-80" x2="0" y2="80" stroke="#cfd8dc" strokeDasharray="4" />

            {/* Beam Twisting */}
            <g transform={`rotate(${beamTwist * 2})`}>
              <rect x="-30" y="-80" width="60" height="15" fill="#455a64" rx="2" />
              <rect x="-30" y="60" width="60" height="15" fill="#455a64" rx="2" />
              <rect x="-8" y="-65" width="16" height="125" fill="#546e7a" />
              <rect x="-8" y="-95" width="16" height="15" fill="#e65100" /> {/* Rail */}

              {/* Tie Back Visual */}
              {hasTieBack && <rect x="-90" y="-80" width="60" height="8" fill="#66bb6a" />}
            </g>

            {/* Measurement */}
            {beamTwist > 0.5 && (
              <g>
                <line x1="0" y1="-110" x2={beamTwist * 5} y2="-110" stroke="#e91e63" strokeWidth="2" />
                <text
                  x={beamTwist * 2.5}
                  y="-120"
                  textAnchor="middle"
                  fill="#e91e63"
                  fontWeight="bold"
                >
                  {beamTwist.toFixed(1)} mm
                </text>
              </g>
            )}
          </svg>

          <div style={{ fontSize: 12, color: "#78909c" }}>ระยะบิดของคาน (Beam Twist)</div>
        </div>

        {/* RIGHT CARD: DATA */}
        <div style={styles.card}>
          <div style={{ width: "100%", marginBottom: 15 }}>
            <div style={{ fontSize: 12, color: "#78909c" }}>แรงดันข้าง (Side Thrust)</div>
            <div style={{ fontSize: 32, fontWeight: "900", color: "#c62828" }}>
              {lateralForce.toFixed(2)} <span style={{ fontSize: 16 }}>Ton</span>
            </div>
          </div>

          <div style={{ width: "100%", marginBottom: 15 }}>
            <div style={{ fontSize: 12, color: "#78909c" }}>ระยะบิดตัว (Twist Distance)</div>
            <div style={{ fontSize: 32, fontWeight: "900", color: isCritical ? "#d32f2f" : "#2e7d32" }}>
              {beamTwist.toFixed(1)} <span style={{ fontSize: 16 }}>mm</span>
            </div>
          </div>

          <div
            style={{
              backgroundColor: isCritical ? "#ffebee" : "#e8f5e9",
              padding: 10,
              borderRadius: 8,
              width: "100%",
              textAlign: "center",
            }}
          >
            {isCritical ? "⚠️ DANGER: รางสึกหรอรุนแรง!" : "✅ SAFE: สึกหรอปกติ"}
          </div>

          {!hasTieBack && (
            <div style={{ fontSize: 11, color: "#d32f2f", marginTop: 10 }}>
              *ไม่มี Tie Back: แรงดันข้างจะงัดคานให้บิด
              <br />
              ทำให้ล้อขบกับมุมรางจนสึกเป็นคมมีด
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CraneLongTravelSim;
