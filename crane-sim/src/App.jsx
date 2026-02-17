import { useEffect, useState } from "react";
import CraneLongTravelSim from "./CraneLongTravelSim";
import CranePeakHoldSim from "./CraneLongTravelSimGEM";

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
  app2: "app2",
};

const PATHS = {
  [VIEWS.home]: "/",
  [VIEWS.app1]: "/app-1",
  [VIEWS.app2]: "/app-2",
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

  if (view === VIEWS.app2) {
    return (
      <div style={styles.shell}>
        <div style={styles.topBar}>
          <button type="button" style={styles.backBtn} onClick={() => navigateTo(VIEWS.home)}>
            Back to Home
          </button>
        </div>
        <CranePeakHoldSim />
      </div>
    );
  }

  return (
    <div style={styles.shell}>
      <div style={styles.container}>
        <h1 style={styles.title}>Crane Simulation Hub</h1>
        <p style={styles.subtitle}>Choose an app to open</p>

        <div style={styles.grid}>
          <button type="button" style={styles.cardBtn} onClick={() => navigateTo(VIEWS.app1)}>
            <p style={styles.cardTitle}>App 1: Long Travel Skew</p>
            <p style={styles.cardDesc}>Simulate effects of load, trolley position, and tie-back during long-travel motion.</p>
          </button>

          <button type="button" style={styles.cardBtn} onClick={() => navigateTo(VIEWS.app2)}>
            <p style={styles.cardTitle}>App 2: Peak Hold</p>
            <p style={styles.cardDesc}>Test two speed modes with peak hold for displacement and side force.</p>
          </button>
        </div>
      </div>
    </div>
  );
}