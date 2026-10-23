// Deterministic, offline feature pack: search/filter, export, and domain
// insights over the app's own feature_records. No provider calls are made;
// every insight is labelled aiGenerated:false.
export function filterRecords(rows, { search = "", status = "", risk = "" } = {}) {
  const q = String(search || "").trim().toLowerCase();
  return (rows || []).filter((r) => {
    if (status && r.status !== status) return false;
    if (risk && r.risk !== risk) return false;
    if (!q) return true;
    const hay = [r.reference, r.title, r.status, r.owner, r.risk, JSON.stringify(r.payload || {})].join(" ").toLowerCase();
    return hay.includes(q);
  });
}
export function displayValue(value) {
  if (value === false) return "No (false)";
  if (value === true) return "Yes (true)";
  if (value === 0) return "0";
  if (value === "" || value == null) return "Not provided (empty)";
  return String(value);
}
function csvCell(v) {
  if (v === false) return "false";
  if (v === 0) return "0";
  if (v == null) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function recordsToCsv(rows) {
  const cols = ["id","feature_id","reference","title","status","owner","risk","due_date","amount"];
  const lines = [cols.join(",")];
  for (const r of rows || []) lines.push(cols.map((c) => csvCell(c === "due_date" ? String(r[c] ?? "").slice(0,10) : r[c])).join(","));
  return lines.join("\n") + "\n";
}
export function exportRecords(rows, format) {
  if (format === "csv") return { format: "csv", contentType: "text/csv; charset=utf-8", filename: "records.csv", body: recordsToCsv(rows) };
  return { format: "json", contentType: "application/json; charset=utf-8", filename: "records.json", body: JSON.stringify({ aiGenerated: false, items: rows || [] }, null, 2) };
}
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
export function buildInsights(records, config, feature) {
  const rows = records || [];
  const rule = config?.calculation || {};
  let varianceTotal = 0;
  for (const r of rows) {
    const p = r.payload || {};
    const actual = num(p[rule.actualKey]); const expected = num(p[rule.expectedKey]);
    if (actual || expected) varianceTotal += Math.max(0, rule.direction === "expected-minus-actual" ? expected - actual : actual - expected);
  }
  const open = rows.filter((r) => !["Approved","Closed"].includes(r.status));
  const highRisk = rows.filter((r) => ["High","Critical"].includes(r.risk));
  const totalValue = rows.reduce((s, r) => s + num(r.amount), 0);
  const triage = [...highRisk, ...open.filter((r) => !highRisk.includes(r))].slice(0, 5).map((r) => `${r.reference}: ${r.title} (${r.risk}, ${r.status})`);
  const actions = open.slice(0, 5).map((r) => `Follow up ${r.reference} — ${r.title} with owner ${r.owner || "Not provided (empty)"}`);
  return {
    aiGenerated: false,
    label: "Deterministic fallback — no AI provider called",
    provider: "Deterministic domain engine",
    featureId: feature?.id || null,
    features: [
      { id: "recovery-summary", title: `${feature?.title || "Domain"} — recovery summary`, sections: [
        { label: "Total records reviewed", value: rows.length },
        { label: rule.varianceLabel || "Potential recovery variance", value: Math.round(varianceTotal * 100) / 100 },
        { label: "Represented value", value: Math.round(totalValue * 100) / 100 },
        { label: "Open records", value: open.length },
        { label: "Has high-risk records", value: highRisk.length > 0 },
      ]},
      { id: "risk-triage", title: `${feature?.title || "Domain"} — risk triage`, sections: [
        { label: "High or critical risk records", value: highRisk.length },
        { label: "Priority records", value: triage.length ? triage.join("; ") : "" },
        { label: "All records closed", value: rows.length > 0 && open.length === 0 },
      ]},
      { id: "next-actions", title: `${feature?.title || "Domain"} — recommended next actions`, sections: [
        { label: "Suggested follow-ups", value: actions.length ? actions.join("; ") : "" },
        { label: "Follow-up count", value: actions.length },
        ...(rule.actions || []).slice(0, 2).map((a, i) => ({ label: `Governed action ${i + 1}`, value: a })),
      ]},
    ],
  };
}
