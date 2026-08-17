import { useEffect, useState, useCallback } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const STATUS_COLORS = {
  waiting: "#f59e0b",
  active: "#3b82f6",
  completed: "#10b981",
  failed: "#ef4444",
  "dead-letter": "#7c3aed",
};

function StatCard({ label, value, color }) {
  return (
    <div style={{ ...styles.statCard, borderTop: `3px solid ${color}` }}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span style={{ ...styles.badge, backgroundColor: STATUS_COLORS[status] || "#6b7280" }}>
      {status}
    </span>
  );
}

export default function App() {
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [failureRate, setFailureRate] = useState(35);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [jobsRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/api/jobs`),
        fetch(`${API_URL}/api/jobs/stats`),
      ]);
      if (!jobsRes.ok || !statsRes.ok) throw new Error("API request failed");
      setJobs(await jobsRes.json());
      setStats(await statsRes.json());
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [fetchData]);

  async function submitJob() {
    setSubmitting(true);
    try {
      await fetch(`${API_URL}/api/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "demo-task",
          payload: { failureRate: failureRate / 100, durationMs: 1000 },
          maxAttempts: 3,
        }),
      });
      await fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>QueueForge</h1>
        <p style={styles.subtitle}>Distributed job scheduler — live dashboard</p>
      </header>

      {error && <div style={styles.error}>⚠ {error} — is the API running?</div>}

      <section style={styles.statsRow}>
        <StatCard label="Waiting" value={stats.waiting ?? "–"} color={STATUS_COLORS.waiting} />
        <StatCard label="Active" value={stats.active ?? "–"} color={STATUS_COLORS.active} />
        <StatCard label="Completed" value={stats.completed ?? "–"} color={STATUS_COLORS.completed} />
        <StatCard label="Failed (retrying)" value={stats.failed ?? "–"} color={STATUS_COLORS.failed} />
        <StatCard label="Dead Letter" value={stats["dead-letter"] ?? "–"} color={STATUS_COLORS["dead-letter"]} />
      </section>

      <section style={styles.submitBox}>
        <label style={styles.label}>
          Simulated failure rate: {failureRate}%
          <input
            type="range"
            min="0"
            max="90"
            value={failureRate}
            onChange={(e) => setFailureRate(Number(e.target.value))}
            style={styles.slider}
          />
        </label>
        <button onClick={submitJob} disabled={submitting} style={styles.button}>
          {submitting ? "Submitting…" : "Submit Job"}
        </button>
      </section>

      <section style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Job</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Attempts</th>
              <th style={styles.th}>Submitted</th>
              <th style={styles.th}>Last Update</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job._id}>
                <td style={styles.td}>{job.name}</td>
                <td style={styles.td}><StatusBadge status={job.status} /></td>
                <td style={styles.td}>{job.attemptsMade} / {job.maxAttempts}</td>
                <td style={styles.td}>{new Date(job.createdAt).toLocaleTimeString()}</td>
                <td style={styles.td}>
                  {job.history?.[job.history.length - 1]?.note || "—"}
                </td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr><td style={styles.td} colSpan={5}>No jobs yet — submit one above.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

const styles = {
  page: { fontFamily: "system-ui, sans-serif", maxWidth: 960, margin: "0 auto", padding: "32px 20px", color: "#111827" },
  header: { marginBottom: 24 },
  title: { fontSize: 32, margin: 0 },
  subtitle: { color: "#6b7280", marginTop: 4 },
  error: { background: "#fef2f2", color: "#b91c1c", padding: "10px 14px", borderRadius: 8, marginBottom: 16 },
  statsRow: { display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" },
  statCard: { flex: "1 1 140px", background: "#f9fafb", borderRadius: 8, padding: "14px 16px" },
  statValue: { fontSize: 26, fontWeight: 700 },
  statLabel: { color: "#6b7280", fontSize: 13, marginTop: 2 },
  submitBox: { display: "flex", alignItems: "center", gap: 20, background: "#f9fafb", padding: 16, borderRadius: 8, marginBottom: 24 },
  label: { display: "flex", flexDirection: "column", fontSize: 14, color: "#374151", flex: 1 },
  slider: { marginTop: 8 },
  button: { background: "#2563eb", color: "#fff", border: "none", padding: "10px 18px", borderRadius: 6, cursor: "pointer", fontSize: 14, fontWeight: 600 },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "10px 12px", borderBottom: "2px solid #e5e7eb", fontSize: 13, color: "#6b7280" },
  td: { padding: "10px 12px", borderBottom: "1px solid #f3f4f6", fontSize: 14 },
  badge: { color: "#fff", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, textTransform: "capitalize" },
};
