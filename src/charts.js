import { formatNumber, formatPercent } from "./metrics.js";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatShortDate(date) {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function makeLinePath(points) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");
}

export function createTrendChartSvg(
  series,
  { width = 820, height = 300 } = {}
) {
  if (!series.length) {
    return '<div class="chart-empty">暂无可绘制的趋势数据</div>';
  }

  const margin = { top: 28, right: 28, bottom: 42, left: 42 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const values = series
    .flatMap((day) => [day.playIndex, day.touchIndex])
    .filter(Number.isFinite);

  if (!values.length) {
    return '<div class="chart-empty">指数基线为 0，暂时无法计算趋势。</div>';
  }

  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const minValue = Math.max(0, Math.floor((rawMin - 10) / 20) * 20);
  const maxValue = Math.max(minValue + 40, Math.ceil((rawMax + 10) / 20) * 20);
  const xFor = (index) =>
    margin.left +
    (series.length === 1 ? plotWidth / 2 : (plotWidth * index) / (series.length - 1));
  const yFor = (value) =>
    margin.top + ((maxValue - value) / (maxValue - minValue)) * plotHeight;
  const playPoints = series
    .map((day, index) =>
      Number.isFinite(day.playIndex)
        ? {
            x: xFor(index),
            y: yFor(day.playIndex),
            value: day.playIndex
          }
        : null
    )
    .filter(Boolean);
  const touchPoints = series
    .map((day, index) =>
      Number.isFinite(day.touchIndex)
        ? {
            x: xFor(index),
            y: yFor(day.touchIndex),
            value: day.touchIndex
          }
        : null
    )
    .filter(Boolean);
  const playPath = makeLinePath(playPoints);
  const touchPath = makeLinePath(touchPoints);
  const baseline = margin.top + plotHeight;
  const areaPath =
    playPoints.length > 0
      ? `${playPath} L${playPoints.at(-1).x},${baseline} L${playPoints[0].x},${baseline} Z`
      : "";
  const tickValues = Array.from({ length: 5 }, (_, index) =>
    Math.round(minValue + ((maxValue - minValue) * index) / 4)
  );
  const grid = tickValues
    .map((value) => {
      const y = yFor(value);
      return `
        <line class="chart-grid-line" x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" />
        <text class="chart-axis-label" x="${margin.left - 10}" y="${y + 4}" text-anchor="end">${value}</text>
      `;
    })
    .join("");
  const dateLabels = series
    .map(
      (day, index) => `
        <text class="chart-tick-label" x="${xFor(index)}" y="${height - 12}" text-anchor="middle">
          ${escapeHtml(formatShortDate(day.date))}
        </text>
      `
    )
    .join("");
  const playMarkers = playPoints
    .map(
      (point) => `
        <circle class="chart-point is-play" cx="${point.x}" cy="${point.y}" r="4.5" />
        <text class="chart-point-label" x="${point.x}" y="${point.y - 11}" text-anchor="middle">${Math.round(point.value)}</text>
      `
    )
    .join("");
  const touchMarkers = touchPoints
    .map(
      (point) => `
        <circle class="chart-point is-touch" cx="${point.x}" cy="${point.y}" r="4.5" />
        <text class="chart-point-label" x="${point.x}" y="${point.y + 17}" text-anchor="middle">${Math.round(point.value)}</text>
      `
    )
    .join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="trend-chart-title trend-chart-desc">
      <title id="trend-chart-title">播放与触达指数趋势</title>
      <desc id="trend-chart-desc">首日设为 100，展示三天内播放指数与触达指数的相对变化。</desc>
      ${grid}
      ${areaPath ? `<path class="chart-area" d="${areaPath}" />` : ""}
      ${playPoints.length > 0 ? `<path class="chart-line is-play" d="${playPath}" />` : ""}
      ${touchPoints.length > 0 ? `<path class="chart-line is-touch" d="${touchPath}" />` : ""}
      ${playMarkers}
      ${touchMarkers}
      ${dateLabels}
      <text class="chart-axis-label" x="10" y="17">指数</text>
    </svg>
  `;
}

export function createFunnelMarkup(stages) {
  const maxValue = Math.max(...stages.map((stage) => stage.value));
  const maxLog = Math.log10(maxValue + 1);

  return stages
    .map((stage, index) => {
      const logScale = Math.max(0.08, Math.log10(stage.value + 1) / maxLog);
      const conversion =
        stage.conversionFromPrevious === null
          ? "起点"
          : `转化 ${formatPercent(stage.conversionFromPrevious)}`;

      return `
        <div class="funnel-stage">
          <div class="funnel-stage-label">
            <span>STEP ${String(index + 1).padStart(2, "0")}</span>
            <strong>${escapeHtml(stage.label)}</strong>
          </div>
          <div class="funnel-track">
            <div class="funnel-bar-track" aria-hidden="true">
              <div class="funnel-bar" style="width:${(logScale * 100).toFixed(1)}%"></div>
            </div>
            <div class="funnel-step-meta">
              <strong>${formatNumber(stage.value)}</strong>
              <span>${conversion}</span>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}
