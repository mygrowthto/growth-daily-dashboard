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
} from "./metrics.js";
import { createFunnelMarkup, createTrendChartSvg } from "./charts.js";

const state = {
  data: null,
  selectedIndex: 0
};

const elements = {
  dateSwitcher: document.querySelector("#date-switcher"),
  dateRange: document.querySelector("#date-range"),
  snapshotDate: document.querySelector("#snapshot-date"),
  kpiGrid: document.querySelector("#kpi-grid"),
  signalBanner: document.querySelector("#signal-banner"),
  signalList: document.querySelector("#signal-list"),
  trendChart: document.querySelector("#trend-chart"),
  funnelDate: document.querySelector("#funnel-date"),
  funnelChart: document.querySelector("#funnel-chart"),
  experimentGrid: document.querySelector("#experiment-grid"),
  experimentReadoutText: document.querySelector("#experiment-readout-text"),
  tableCaption: document.querySelector("#table-caption"),
  tableBody: document.querySelector("#daily-table-body"),
  limitationsList: document.querySelector("#limitations-list"),
  navLinks: [...document.querySelectorAll("[data-nav-link]")]
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(date) {
  const parsed = new Date(`${date}T12:00:00`);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(parsed);
}

function formatShortDate(date) {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function getDelta(current, previous, inverse = false) {
  if (previous === undefined || previous === null) {
    return {
      value: "基准日",
      title: "这是样例中的首日，没有前一日可比较",
      className: "delta delta-neutral"
    };
  }

  const change = safeRatio(current - previous, previous);
  if (change === null) {
    return {
      value: "无可比基数",
      title: "前一日基数为 0，无法计算相对变化",
      className: "delta delta-neutral"
    };
  }

  const isNegative = inverse ? change > 0 : change < 0;
  return {
    value: formatSignedPercent(change),
    title: `较前一日相对变化 ${formatSignedPercent(change)}`,
    className: `delta${isNegative ? " delta-down" : ""}`
  };
}

function getPercentagePointDelta(current, previous) {
  if (previous === undefined || previous === null) {
    return {
      value: "基准日",
      title: "这是样例中的首日，没有前一日可比较",
      className: "delta delta-neutral"
    };
  }

  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return {
      value: "-",
      title: "当前指标无法比较",
      className: "delta delta-neutral"
    };
  }

  const change = current - previous;
  return {
    value: formatSignedPercentagePoints(change),
    title: `较前一日变化 ${formatSignedPercentagePoints(change)}`,
    className: `delta${change < 0 ? " delta-down" : ""}`
  };
}

function buildKpiCard({ code, label, value, unit, footer, delta, warning = false }) {
  return `
    <article class="kpi-card${warning ? " kpi-warning" : ""}">
      <div class="kpi-head">
        <span>${escapeHtml(label)}</span>
        <span class="kpi-code">${escapeHtml(code)}</span>
      </div>
      <p class="kpi-value">${escapeHtml(value)}${unit ? `<small>${escapeHtml(unit)}</small>` : ""}</p>
      <div class="kpi-foot">
        <span class="${warning ? "quality-note" : ""}">${escapeHtml(footer)}</span>
        <span
          class="${delta.className}"
          title="${escapeHtml(delta.title)}"
          aria-label="${escapeHtml(delta.title)}"
        >${escapeHtml(delta.value)}</span>
      </div>
    </article>
  `;
}

function renderDateSwitcher() {
  const days = state.data.days;
  elements.dateSwitcher.innerHTML = days
    .map(
      (day, index) => `
        <button
          class="date-button"
          type="button"
          data-date-index="${index}"
          aria-pressed="${index === state.selectedIndex}"
        >
          <strong>${escapeHtml(formatShortDate(day.date))}</strong>
          <span>${escapeHtml(formatDate(day.date))}</span>
        </button>
      `
    )
    .join("");

  elements.dateRange.textContent = `${formatShortDate(days[0].date)} - ${formatShortDate(days.at(-1).date)}`;
}

function renderKpis() {
  const days = state.data.days;
  const current = computeDayMetrics(days[state.selectedIndex]);
  const previousDay = days[state.selectedIndex - 1];
  const previous = previousDay ? computeDayMetrics(previousDay) : null;

  const cards = [
    buildKpiCard({
      code: "PLAY",
      label: "内容播放",
      value: formatNumber(current.plays),
      unit: "次",
      footer: "内容曝光规模",
      delta: getDelta(current.plays, previous?.plays)
    }),
    buildKpiCard({
      code: "TOUCH",
      label: "私信触达",
      value: formatNumber(current.touches),
      unit: "人",
      footer: `播放触达比 ${formatPercent(current.playToTouchRate, 2)}`,
      delta: getDelta(current.touches, previous?.touches)
    }),
    buildKpiCard({
      code: "REPLY",
      label: "回复率",
      value: formatPercent(current.replyRate),
      footer: `${formatNumber(current.replies)} 次回复 / ${formatNumber(current.touches)} 次触达`,
      delta: getPercentagePointDelta(current.replyRate, previous?.replyRate)
    }),
    buildKpiCard({
      code: "WECHAT",
      label: "微信转化率",
      value: formatPercent(current.wechatRate),
      footer: current.hasReportedRateMismatch ? "已按原始计数重算" : "按原始计数计算",
      warning: current.hasReportedRateMismatch,
      delta: getPercentagePointDelta(current.wechatRate, previous?.wechatRate)
    })
  ];

  elements.kpiGrid.innerHTML = cards.join("");
  elements.snapshotDate.textContent = `${formatDate(current.date)} · ${current.scriptVersion} 版话术`;
}

function signalClass(signal) {
  if (signal.severity === "warning") {
    return "warning";
  }

  if (signal.severity === "positive") {
    return "positive";
  }

  return "neutral";
}

function renderSignals() {
  const signals = detectSignals(state.data.days);
  const selectedDate = state.data.days[state.selectedIndex].date;
  const contextSignals = signals.filter(
    (signal) => !signal.date || signal.date === selectedDate
  );
  const orderedSignals = [
    ...contextSignals,
    ...signals.filter((signal) => !contextSignals.includes(signal))
  ];
  const primary =
    contextSignals.find((signal) => signal.severity === "warning") ??
    contextSignals.find((signal) => signal.severity === "positive") ??
    contextSignals[0] ??
    orderedSignals[0];
  const primaryClass = primary ? signalClass(primary) : "neutral";

  elements.signalBanner.className = `signal-banner is-${primaryClass}`;
  elements.signalBanner.innerHTML = `
    <div>
      <span class="signal-kicker">当前状态</span>
      <strong>${escapeHtml(primary?.title ?? "暂无异常")}</strong>
    </div>
    <span class="status-badge">${primaryClass === "warning" ? "CHECK" : primaryClass === "positive" ? "MOVING" : "SAMPLE"}</span>
  `;

  elements.signalList.innerHTML = orderedSignals
    .slice(0, 4)
    .map(
      (signal) => `
        <article class="signal-item is-${signalClass(signal)}">
          <div class="signal-item-head">
            <span class="signal-type" aria-hidden="true"></span>
            <h4>${escapeHtml(signal.title)}</h4>
          </div>
          <p>${escapeHtml(signal.detail)}</p>
        </article>
      `
    )
    .join("");
}

function renderTrend() {
  const width = Math.max(
    300,
    Math.min(820, elements.trendChart.clientWidth || 820)
  );
  const height = width < 520 ? 280 : 300;

  elements.trendChart.innerHTML = createTrendChartSvg(
    buildSeries(state.data.days),
    { width, height }
  );
}

function renderFunnel() {
  const current = state.data.days[state.selectedIndex];
  const funnel = buildFunnel(current);

  elements.funnelDate.textContent = `${formatDate(current.date)} · 四段链路`;
  elements.funnelChart.innerHTML = createFunnelMarkup(funnel);
}

function renderExperiment() {
  const comparison = aggregateScriptComparison(
    state.data.days,
    state.data.scriptVersions
  );
  const leadingRate = Math.max(...comparison.map((item) => item.replyRate ?? 0));

  elements.experimentGrid.innerHTML = comparison
    .map(
      (item) => `
        <article class="script-card${item.replyRate === leadingRate ? " is-leading" : ""}">
          <div class="script-card-head">
            <div>
              <p class="eyebrow">SCRIPT VERSION ${escapeHtml(item.id)}</p>
              <h3>${escapeHtml(item.label)}</h3>
              <p class="script-description">${escapeHtml(item.description)}</p>
            </div>
            <span class="script-version" aria-label="版本 ${escapeHtml(item.id)}">${escapeHtml(item.id)}</span>
          </div>
          <p class="script-rate">${formatPercent(item.replyRate)}<span>加权回复率</span></p>
          <div class="script-bar" aria-hidden="true">
            <span style="width:${((item.replyRate / leadingRate) * 100).toFixed(1)}%"></span>
          </div>
          <div class="script-stats">
            <span><strong>${item.days}</strong> 天</span>
            <span><strong>${formatNumber(item.touches)}</strong> 触达</span>
            <span><strong>${formatNumber(item.replies)}</strong> 回复</span>
          </div>
        </article>
      `
    )
    .join("");

  const versionA = comparison.find((item) => item.id === "A");
  const versionB = comparison.find((item) => item.id === "B");
  elements.experimentReadoutText.textContent =
    versionA && versionB
      ? `A/B 观察性复盘：B 版加权回复率 ${formatPercent(versionB.replyRate)}，A 版 ${formatPercent(versionA.replyRate)}。但两版按日期分组（A 版 ${versionA.days} 天 / B 版 ${versionB.days} 天、${formatNumber(versionB.touches)} 次触达），未做随机分流，且播放、内容与互动分层都可能变化，因此只能提示方向、不能声称因果。规范做法是固定素材与入口、在同一分层内随机分流、预设样本量与护栏指标并观察 7–14 天。`
      : "当前版本记录的样本不一致，暂不形成方向性结论。";
}

function renderTable() {
  const metrics = state.data.days.map(computeDayMetrics);

  elements.tableCaption.innerHTML = `
    <span><strong>${state.data.days.length} 天</strong> · 按原始计数重算</span>
    <span>${escapeHtml(state.data.meta.period)}</span>
  `;
  elements.tableBody.innerHTML = metrics
    .map(
      (day, index) => `
        <tr class="${index === state.selectedIndex ? "is-selected" : ""}">
          <th scope="row">${escapeHtml(formatShortDate(day.date))}</th>
          <td class="numeric">${formatNumber(day.plays)}</td>
          <td class="numeric">${formatNumber(day.touches)}</td>
          <td class="numeric">${formatNumber(day.replies)}</td>
          <td class="numeric">${formatNumber(day.wechatCount)}</td>
          <td class="numeric">${formatPercent(day.reportedWechatRate)}</td>
          <td class="numeric">${formatPercent(day.wechatRate)}</td>
          <td>
            <span class="status-tag${day.hasReportedRateMismatch ? " is-corrected" : ""}">
              ${day.hasReportedRateMismatch ? "已修正口径" : "口径一致"}
            </span>
          </td>
        </tr>
      `
    )
    .join("");
}

function renderMethod() {
  elements.limitationsList.innerHTML = state.data.meta.limitations
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
}

function updateDateButtons() {
  elements.dateSwitcher
    .querySelectorAll("[data-date-index]")
    .forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(Number(button.dataset.dateIndex) === state.selectedIndex)
      );
    });
}

function renderSelectedState() {
  updateDateButtons();
  renderKpis();
  renderSignals();
  renderFunnel();
  renderTable();
}

function selectDate(index) {
  if (index < 0 || index >= state.data.days.length) {
    return;
  }

  state.selectedIndex = index;
  renderSelectedState();
}

function setupNavigationObserver() {
  const sections = [...document.querySelectorAll("[data-section]")];
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (!visible) {
        return;
      }

      elements.navLinks.forEach((link) => {
        link.classList.toggle(
          "is-active",
          link.getAttribute("href") === `#${visible.target.id}`
        );
      });
    },
    {
      rootMargin: "-20% 0px -58% 0px",
      threshold: [0.08, 0.3, 0.6]
    }
  );

  sections.forEach((section) => observer.observe(section));
}

function bindEvents() {
  elements.dateSwitcher.addEventListener("click", (event) => {
    const button = event.target.closest("[data-date-index]");
    if (!button) {
      return;
    }

    selectDate(Number(button.dataset.dateIndex));
  });

  let resizeFrame = null;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(renderTrend);
  });
}

function showLoadError(error) {
  elements.kpiGrid.innerHTML = `
    <div class="error-panel">
      <strong>日报数据没有加载成功。</strong>
      <p>${escapeHtml(error.message)}</p>
    </div>
  `;
  elements.signalBanner.innerHTML = `
    <div>
      <span class="signal-kicker">加载失败</span>
      <strong>请通过本地服务器打开页面，而不是直接双击 HTML 文件。</strong>
    </div>
    <span class="status-badge">ERROR</span>
  `;
}

async function init() {
  try {
    const response = await fetch("./data/daily-data.json");
    if (!response.ok) {
      throw new Error(`数据请求失败：HTTP ${response.status}`);
    }

    state.data = await response.json();
    state.selectedIndex = state.data.days.length - 1;

    renderDateSwitcher();
    renderSelectedState();
    renderTrend();
    renderExperiment();
    renderMethod();
    bindEvents();
    setupNavigationObserver();
  } catch (error) {
    showLoadError(error);
  }
}

init();
