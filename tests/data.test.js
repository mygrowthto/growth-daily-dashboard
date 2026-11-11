import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { computeDayMetrics } from "../src/metrics.js";

const dataPath = fileURLToPath(
  new URL("../data/daily-data.json", import.meta.url)
);

function loadDashboardData() {
  return JSON.parse(readFileSync(dataPath, "utf8"));
}

test("source data contains the three reviewed days", () => {
  const data = loadDashboardData();

  assert.equal(data.meta.sample, true);
  assert.deepEqual(
    data.days.map((day) => day.date),
    ["2026-08-01", "2026-08-02", "2026-08-03"]
  );
});

test("source values match the reviewed daily report", () => {
  const [firstDay] = loadDashboardData().days;

  assert.equal(firstDay.plays, 86900);
  assert.equal(firstDay.touches, 397);
  assert.equal(firstDay.replies, 25);
  assert.equal(firstDay.directWechat, 19);
  assert.equal(firstDay.organicWechat, 6);
  assert.equal(firstDay.reportedWechatRate, 0.043);
});

test("all source counts are finite non-negative numbers", () => {
  const data = loadDashboardData();
  const numericFields = [
    "plays",
    "touches",
    "replies",
    "directWechat",
    "organicWechat",
    "reportedWechatRate"
  ];

  for (const day of data.days) {
    for (const field of numericFields) {
      assert.equal(Number.isFinite(day[field]), true, `${day.date} ${field}`);
      assert.equal(day[field] >= 0, true, `${day.date} ${field}`);
    }
  }
});

test("only the first day carries the visible percentage mismatch", () => {
  const metrics = loadDashboardData().days.map(computeDayMetrics);

  assert.equal(metrics[0].hasReportedRateMismatch, true);
  assert.equal(metrics[1].hasReportedRateMismatch, false);
  assert.equal(metrics[2].hasReportedRateMismatch, false);
});
