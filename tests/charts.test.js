import test from "node:test";
import assert from "node:assert/strict";

import {
  createFunnelMarkup,
  createTrendChartSvg
} from "../src/charts.js";
import { buildFunnel, buildSeries } from "../src/metrics.js";

const days = [
  {
    date: "2026-08-01",
    plays: 86900,
    touches: 397,
    replies: 25,
    directWechat: 19,
    organicWechat: 6,
    reportedWechatRate: 0.043
  },
  {
    date: "2026-08-02",
    plays: 141000,
    touches: 507,
    replies: 28,
    directWechat: 22,
    organicWechat: 6,
    reportedWechatRate: 0.055
  },
  {
    date: "2026-08-03",
    plays: 111900,
    touches: 342,
    replies: 26,
    directWechat: 24,
    organicWechat: 2,
    reportedWechatRate: 0.076
  }
];

test("trend chart renders both indexed series and all date labels", () => {
  const markup = createTrendChartSvg(buildSeries(days));

  assert.match(markup, /viewBox="0 0 820 300"/);
  assert.match(markup, /class="chart-line is-play"/);
  assert.match(markup, /class="chart-line is-touch"/);
  assert.match(markup, /8\/1/);
  assert.match(markup, /8\/2/);
  assert.match(markup, /8\/3/);
});

test("funnel markup includes values and formulas without unsafe HTML", () => {
  const markup = createFunnelMarkup(buildFunnel(days[0]));

  assert.match(markup, /播放/);
  assert.match(markup, /86,900/);
  assert.match(markup, /397/);
  assert.match(markup, /6\.3%/);
  assert.doesNotMatch(markup, /<script/i);
});

test("trend chart handles an empty series without throwing", () => {
  const markup = createTrendChartSvg([]);

  assert.match(markup, /暂无可绘制的趋势数据/);
});
