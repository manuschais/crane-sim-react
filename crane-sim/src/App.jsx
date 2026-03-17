import { useEffect, useState } from "react";
import CraneLongTravelSim from "./CraneLongTravelSim";

const styles = {
  shell: {
    minHeight: "100vh",
    padding: "24px",
    background: "linear-gradient(160deg, #e2e8f0 0%, #f8fafc 60%, #dbeafe 100%)",
    fontFamily: "'Sarabun', sans-serif",
  },
  container: {
    maxWidth: "980px",
    margin: "0 auto",
    background: "#ffffff",
    borderRadius: "16px",
    padding: "24px",
    boxShadow: "0 16px 35px rgba(15, 23, 42, 0.12)",
  },
  title: { margin: 0, fontSize: "32px", color: "#0f172a" },
  subtitle: { color: "#475569", marginTop: "8px", marginBottom: "20px" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" },
  cardBtn: {
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    background: "#f8fafc",
    padding: "16px",
    textAlign: "left",
    cursor: "pointer",
  },
  cardTitle: { margin: "0 0 6px", color: "#0f172a", fontSize: "18px", fontWeight: 800 },
  cardDesc: { margin: 0, color: "#475569", fontSize: "14px" },
  topBar: { marginBottom: "12px" },
  backBtn: {
    border: "none",
    borderRadius: "10px",
    padding: "10px 14px",
    background: "#0f172a",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 700,
  },
};

const VIEWS = {
  home: "home",
  app1: "app1",
};

const PATHS = {
  [VIEWS.home]: "/",
  [VIEWS.app1]: "/app-1",
};

const BASE_URL = import.meta.env.BASE_URL || "/";

function trimTrailingSlash(value) {
  if (value === "/") return "/";
  return value.replace(/\/+$/, "");
}

function buildUrl(path) {
  const base = trimTrailingSlash(BASE_URL);
  return base === "/" ? path : `${base}${path}`;
}

function normalizePath(pathname) {
  const base = trimTrailingSlash(BASE_URL);
  let path = pathname;

  if (base !== "/" && path.startsWith(base)) {
    const sliced = path.slice(base.length);
    path = sliced.startsWith("/") ? sliced : `/${sliced}`;
  }

  if (!path.startsWith("/")) path = `/${path}`;
  path = path.replace(/\/+$/, "");
  return path || "/";
}

function getViewFromPath(pathname) {
  const normalized = normalizePath(pathname);
  if (normalized === PATHS.app1) return VIEWS.app1;
  if (normalized === PATHS.app2) return VIEWS.app2;
  return VIEWS.home;
}

export default function App() {
  const [view, setView] = useState(() => getViewFromPath(window.location.pathname));

  useEffect(() => {
    const onPopState = () => {
      setView(getViewFromPath(window.location.pathname));
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigateTo = (nextView) => {
    const targetPath = PATHS[nextView] || PATHS.home;
    const nextUrl = buildUrl(targetPath);

    if (window.location.pathname !== nextUrl) {
      window.history.pushState({}, "", nextUrl);
    }
    setView(nextView);
  };

  if (view === VIEWS.app1) {
    return (
      <div style={styles.shell}>
        <div style={styles.topBar}>
          <button type="button" style={styles.backBtn} onClick={() => navigateTo(VIEWS.home)}>
            Back to Home
          </button>
        </div>
        <CraneLongTravelSim />
      </div>
    );
  }

  return (
    <div style={styles.shell}>
      <div style={styles.container}>
        <h1 style={styles.title}>Crane Skew Simulation</h1>
        <p style={styles.subtitle}>25 Ton Overhead Crane — Long Travel &amp; Cross Travel</p>

        <div style={styles.grid}>
          <button type="button" style={{ ...styles.cardBtn, gridColumn: "1 / -1" }} onClick={() => navigateTo(VIEWS.app1)}>
            <p style={styles.cardTitle}>Long Travel &amp; Cross Travel Skew</p>
            <p style={styles.cardDesc}>
              Switch between Long Travel (crane on runway beams) and Cross Travel (trolley on bridge girder).
              Analyse side thrust, torsion, lateral deflection, and weld stress with tie-back comparison.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}