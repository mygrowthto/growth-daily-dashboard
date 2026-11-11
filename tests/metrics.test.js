import test from "node:test";
import assert from "node:assert/strict";

import {
  aggregateScriptComparison,
  buildFunnel,
  buildSeries,
  computeDayMetrics,
  detectSignals,
  formatNumber,
  formatPercent,
  formatSignedPercentagePoints,
  formatSignedPercent,
  safeRatio
} from "../src/metrics.js";

test("safeRatio divides two finite numbers", () => {
  assert.equal(safeRatio(25, 397), 25 / 397);
});

test("safeRatio returns null for an invalid denominator", () => {
  assert.equal(safeRatio(25, 0), null);
  assert.equal(safeRatio(25, -1), null);
});

test("formatPercent shows one decimal place", () => {
  assert.equal(formatPercent(25 / 397), "6.3%");
  assert.equal(formatPercent(0.055), "5.5%");
});

test("formatPercent keeps an unknown value visible", () => {
  assert.equal(formatPercent(null), "-");
});

const day = {
  date: "2026-08-01",
  plays: 86900,
  touches: 397,
  replies: 25,
  directWechat: 19,
  organicWechat: 6,
  reportedWechatRate: 0.043
};

test("computeDayMetrics derives rates from source counts", () => {
  const metrics = computeDayMetrics(day);

  assert.equal(metrics.wechatCount, 25);
  assert.equal(metrics.replyRate, 25 / 397);
  assert.equal(metrics.wechatRate, 25 / 397);
  assert.equal(metrics.playToTouchRate, 397 / 86900);
});

test("computeDayMetrics exposes the reported percentage difference", () => {
  const metrics = computeDayMetrics(day);

  assert.equal(metrics.hasReportedRateMismatch, true);
  assert.equal(metrics.wechatRateDelta, 25 / 397 - 0.043);
});

test("buildSeries creates day-one indices for exposure and touches", () => {
  const series = buildSeries([
    day,
    { ...day, date: "2026-08-02", plays: 173800, touches: 794 }
  ]);

  assert.equal(series[0].playIndex, 100);
  assert.equal(series[1].playIndex, 200);
  assert.equal(series[0].touchIndex, 100);
  assert.equal(series[1].touchIndex, 200);
});

test("buildSeries does not turn an unknown zero baseline into zero index", () => {
  const series = buildSeries([
    { ...day, plays: 0, touches: 0 },
    { ...day, date: "2026-08-02", plays: 10, touches: 5 }
  ]);

  assert.equal(series[0].playIndex, null);
  assert.equal(series[0].touchIndex, null);
  assert.equal(series[1].playIndex, null);
  assert.equal(series[1].touchIndex, null);
});

test("buildFunnel returns four ordered stages and adjacent rates", () => {
  const funnel = buildFunnel({ ...day, replies: 20, directWechat: 10, organicWechat: 2 });

  assert.deepEqual(
    funnel.map((step) => step.label),
    ["播放", "触达", "回复", "微信转化"]
  );
  assert.equal(funnel[1].conversionFromPrevious, 397 / 86900);
  assert.equal(funnel[2].conversionFromPrevious, 20 / 397);
  assert.equal(funnel[3].conversionFromPrevious, 12 / 20);
});

test("detectSignals finds traffic growth that outpaced touch growth", () => {
  const signals = detectSignals([
    day,
    {
      ...day,
      date: "2026-08-02",
      plays: 141000,
      touches: 507,
      replies: 28,
      directWechat: 22,
      organicWechat: 6,
      reportedWechatRate: 0.055
    }
  ]);

  assert.equal(signals.some((signal) => signal.type === "traffic-gap"), true);
});

test("detectSignals states that three days are only a sample", () => {
  const signals = detectSignals([day]);

  assert.equal(signals.some((signal) => signal.type === "sample-limit"), true);
  assert.match(
    signals.find((signal) => signal.type === "sample-limit").title,
    /1 天样本/
  );
});

test("number formatting stays compact and legible", () => {
  assert.equal(formatNumber(118720), "118,720");
  assert.equal(formatNumber(397), "397");
  assert.equal(formatSignedPercent(0.238), "+23.8%");
  assert.equal(formatSignedPercent(-0.12), "-12.0%");
  assert.equal(formatSignedPercentagePoints(0.021), "+2.1 pp");
  assert.equal(formatSignedPercentagePoints(-0.003), "-0.3 pp");
});

test("script comparison weights each version by actual touches", () => {
  const days = [
    { ...day, replies: 25, touches: 397, scriptVersion: "A" },
    { ...day, date: "2026-08-02", replies: 28, touches: 507, scriptVersion: "A" },
    { ...day, date: "2026-08-03", replies: 26, touches: 342, scriptVersion: "B" }
  ];
  const versions = [
    { id: "A", label: "纯介绍版", dates: ["2026-08-01", "2026-08-02"] },
    { id: "B", label: "免费咨询钩子版", dates: ["2026-08-03"] }
  ];

  const comparison = aggregateScriptComparison(days, versions);

  assert.equal(comparison[0].touches, 904);
  assert.equal(comparison[0].replies, 53);
  assert.equal(comparison[0].replyRate, 53 / 904);
  assert.equal(comparison[1].touches, 342);
  assert.equal(comparison[1].replyRate, 26 / 342);
});

test("script comparison rejects a date assigned to multiple versions", () => {
  const versions = [
    { id: "A", label: "A", dates: ["2026-08-01"] },
    { id: "B", label: "B", dates: ["2026-08-01"] }
  ];

  assert.throws(
    () => aggregateScriptComparison([day], versions),
    /multiple script versions/i
  );
});
