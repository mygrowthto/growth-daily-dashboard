export function safeRatio(numerator, denominator) {
  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator <= 0
  ) {
    return null;
  }

  return numerator / denominator;
}

export function formatPercent(value, digits = 1) {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  return `${(value * 100).toFixed(digits)}%`;
}

export function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }

  return new Intl.NumberFormat("en-US").format(value);
}

export function formatSignedPercent(value, digits = 1) {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  const prefix = value >= 0 ? "+" : "";
  return `${prefix}${(value * 100).toFixed(digits)}%`;
}

export function formatSignedPercentagePoints(value, digits = 1) {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  const prefix = value >= 0 ? "+" : "";
  return `${prefix}${(value * 100).toFixed(digits)} pp`;
}

export function computeDayMetrics(day) {
  const wechatCount = day.directWechat + day.organicWechat;
  const replyRate = safeRatio(day.replies, day.touches);
  const wechatRate = safeRatio(wechatCount, day.touches);
  const reportedWechatRate = Number.isFinite(day.reportedWechatRate)
    ? day.reportedWechatRate
    : null;
  const wechatRateDelta =
    wechatRate !== null && reportedWechatRate !== null
      ? wechatRate - reportedWechatRate
      : null;

  return {
    ...day,
    wechatCount,
    replyRate,
    wechatRate,
    playToTouchRate: safeRatio(day.touches, day.plays),
    wechatRateDelta,
    hasReportedRateMismatch:
      wechatRateDelta !== null && Math.abs(wechatRateDelta) >= 0.005
  };
}

export function buildSeries(days) {
  if (!days.length) {
    return [];
  }

  const firstDay = days[0];
  return days.map((day) => {
    const metrics = computeDayMetrics(day);
    return {
      ...metrics,
      playIndex:
        firstDay.plays > 0
          ? safeRatio(day.plays, firstDay.plays) * 100
          : null,
      touchIndex:
        firstDay.touches > 0
          ? safeRatio(day.touches, firstDay.touches) * 100
          : null
    };
  });
}

export function buildFunnel(day) {
  const metrics = computeDayMetrics(day);
  const stages = [
    { label: "播放", value: metrics.plays },
    { label: "触达", value: metrics.touches },
    { label: "回复", value: metrics.replies },
    { label: "微信转化", value: metrics.wechatCount }
  ];

  return stages.map((stage, index) => ({
    ...stage,
    conversionFromPrevious:
      index === 0
        ? null
        : safeRatio(stage.value, stages[index - 1].value)
  }));
}

export function detectSignals(days) {
  const series = buildSeries(days);
  const signals = [];

  if (days.length < 7) {
    signals.push({
      type: "sample-limit",
      severity: "info",
      title: `当前只有 ${days.length} 天样本`,
      detail: "可以观察方向，不能据此判断长期趋势或统计显著性。"
    });
  }

  for (const day of series) {
    if (day.hasReportedRateMismatch) {
      signals.push({
        type: "data-quality",
        severity: "warning",
        date: day.date,
        title: `${day.date.slice(5)} 的转化率需要重算`,
        detail: `原始表显示 ${formatPercent(day.reportedWechatRate)}，按 ${day.wechatCount} / ${day.touches} 应为 ${formatPercent(day.wechatRate)}。`
      });
    }
  }

  for (let index = 1; index < series.length; index += 1) {
    const previous = series[index - 1];
    const current = series[index];
    const playChange = safeRatio(current.plays - previous.plays, previous.plays);
    const touchChange = safeRatio(
      current.touches - previous.touches,
      previous.touches
    );

    if (
      playChange !== null &&
      touchChange !== null &&
      playChange > 0.25 &&
      touchChange < playChange
    ) {
      signals.push({
        type: "traffic-gap",
        severity: "warning",
        date: current.date,
        title: "流量增长没有同步转化为触达",
        detail: `播放 ${formatSignedPercent(playChange)}，触达 ${formatSignedPercent(touchChange)}。应优先检查评论引导、私信入口和承接人力。`
      });
    }

    const replyRateChange =
      current.replyRate !== null && previous.replyRate !== null
        ? current.replyRate - previous.replyRate
        : null;

    if (replyRateChange !== null && replyRateChange >= 0.015) {
      signals.push({
        type: "reply-shift",
        severity: "positive",
        date: current.date,
        title: "回复率出现明显变化",
        detail: `回复率从 ${formatPercent(previous.replyRate)} 变为 ${formatPercent(current.replyRate)}，但单日 ${current.replies} 个回复仍不足以证明话术一定有效。`
      });
    }
  }

  return signals;
}

export function aggregateScriptComparison(days, versions) {
  const dateOwners = new Map();

  for (const version of versions) {
    for (const date of new Set(version.dates)) {
      if (dateOwners.has(date)) {
        throw new Error(
          `Date ${date} is assigned to multiple script versions: ${dateOwners.get(date)} and ${version.id}.`
        );
      }

      dateOwners.set(date, version.id);
    }
  }

  return versions.map((version) => {
    const dates = new Set(version.dates);
    const matchingDays = days.filter((day) => dates.has(day.date));
    const touches = matchingDays.reduce((total, day) => total + day.touches, 0);
    const replies = matchingDays.reduce((total, day) => total + day.replies, 0);

    return {
      ...version,
      days: matchingDays.length,
      touches,
      replies,
      replyRate: safeRatio(replies, touches)
    };
  });
}
