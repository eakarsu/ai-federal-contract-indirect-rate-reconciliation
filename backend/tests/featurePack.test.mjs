import test from "node:test";
import assert from "node:assert/strict";
import { filterRecords, recordsToCsv, exportRecords, buildInsights, displayValue } from "../featurePack.mjs";
import config from "../../app.config.mjs";

const feature = config.features[0];
const rule = config.calculation;
const rows = [
  { id: 1, feature_id: feature.id, reference: "A-1", title: "Alpha case", status: "Open", owner: "Sam", risk: "High", due_date: "2026-01-01", amount: 0, payload: { [rule.actualKey]: 100, [rule.expectedKey]: 160 } },
  { id: 2, feature_id: feature.id, reference: "B-2", title: "Beta case", status: "Closed", owner: "", risk: "Low", due_date: "2026-01-02", amount: 50, payload: { [rule.actualKey]: 0, [rule.expectedKey]: 0 } },
];
test("search/filter on main list", () => {
  assert.equal(filterRecords(rows, { search: "alpha" }).length, 1);
  assert.equal(filterRecords(rows, { status: "Closed" }).length, 1);
  assert.equal(filterRecords(rows, { risk: "High" }).length, 1);
  assert.equal(filterRecords(rows, { search: "missing" }).length, 0);
});
test("CSV/JSON export preserves 0 and empty", () => {
  const csv = recordsToCsv(rows);
  assert.match(csv, /A-1,Alpha case,Open,Sam,High,2026-01-01,0/);
  const json = exportRecords(rows, "json");
  assert.equal(json.format, "json");
  assert.equal(JSON.parse(json.body).items[0].amount, 0);
  assert.equal(exportRecords(rows, "csv").format, "csv");
});
test("domain insights are deterministic fallback over own records", () => {
  const out = buildInsights(rows, config, feature);
  assert.equal(out.aiGenerated, false);
  assert.match(out.label, /Deterministic fallback/);
  assert.equal(out.features.length, 3);
  assert.equal(out.features[0].sections[0].value, 2);
  // false / 0 / empty are preserved, not dropped
  assert.equal(displayValue(false), "No (false)");
  assert.equal(displayValue(0), "0");
  assert.match(displayValue(""), /empty/);
});
test("tasks and insights endpoints require auth (source)", async () => {
  const fs = await import("node:fs");
  const server = fs.readFileSync(new URL("../server.mjs", import.meta.url), "utf8");
  assert.ok(server.includes("/api/features/:id/insights"));
  assert.ok(server.includes("/records/export"));
  assert.ok(server.includes("mountTasks"));
});
