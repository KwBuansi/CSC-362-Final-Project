const CHART_ROOT_SELECTOR = "#chart";
const HOUR_DETAIL_SELECTOR = "#hour-detail-panel";
const DATA_URL = "./data/cleaned_data.csv";

const LOCALE_STYLES = new Map([
  ["urban", { fill: "rgba(23, 107, 89, 0.35)", stroke: "#1e8e4c" }],
  ["suburban", { fill: "rgba(233, 200, 81, 0.34)", stroke: "#b88f00" }],
]);

const width = 1100;
const innerRadius = 200;
const outerRadius = 510;
/** Upright hour numbers sit this far inside the bar inner edge (ticks stay on the edge). */
const hourLabelRadius = innerRadius - 22;
const hPad = 250;
const vPadTop = 42;
const vPadBot = 50;

const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function uniq(arr) {
  return Array.from(new Set(arr));
}

/** Tooltip only: 24-hour integer → "3:00 PM" */
function formatHourAmPm(hour24) {
  const h = ((Math.floor(hour24) % 24) + 24) % 24;
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:00 ${period}`;
}

function hideHourDetailPanel() {
  const panel = document.querySelector(HOUR_DETAIL_SELECTOR);
  if (!panel) return;
  panel.hidden = true;
  d3.select(panel).selectAll("*").remove();
}

/** Pattern defs for the side pie (ids must differ from the main radial SVG). */
function appendDetailPatternDefs(defs) {
  defs.append("pattern")
    .attr("id", "pattern-suburban-diagonal-detail")
    .attr("patternUnits", "userSpaceOnUse")
    .attr("width", 8)
    .attr("height", 8)
    .call(p => p.append("rect")
      .attr("width", 8)
      .attr("height", 8)
      .attr("fill", "rgba(233, 200, 81, 0.18)"))
    .call(p => p.append("line")
      .attr("x1", 0).attr("y1", 2).attr("x2", 8).attr("y2", 2)
      .attr("stroke", "rgba(184, 143, 0, 0.75)").attr("stroke-width", 2)
      .attr("shape-rendering", "crispEdges"))
    .call(p => p.append("line")
      .attr("x1", 0).attr("y1", 6).attr("x2", 8).attr("y2", 6)
      .attr("stroke", "rgba(184, 143, 0, 0.75)").attr("stroke-width", 2)
      .attr("shape-rendering", "crispEdges"));

  defs.append("pattern")
    .attr("id", "pattern-urban-dots-detail")
    .attr("patternUnits", "userSpaceOnUse")
    .attr("width", 10)
    .attr("height", 10)
    .call(p => p.append("rect")
      .attr("width", 10).attr("height", 10)
      .attr("fill", "rgba(23, 107, 89, 0.16)"))
    .call(p => p.append("circle")
      .attr("cx", 3).attr("cy", 3).attr("r", 2.3)
      .attr("fill", "rgba(23, 107, 89, 0.75)"))
    .call(p => p.append("circle")
      .attr("cx", 8).attr("cy", 7).attr("r", 2.3)
      .attr("fill", "rgba(23, 107, 89, 0.75)"));
}

function detailPatternFill(loc) {
  const key = String(loc ?? "").toLowerCase();
  if (key === "urban") return "url(#pattern-urban-dots-detail)";
  if (key === "suburban") return "url(#pattern-suburban-diagonal-detail)";
  return LOCALE_STYLES.get(key)?.fill ?? "#ccc";
}

function detailStrokeForLocale(loc) {
  const key = String(loc ?? "").toLowerCase();
  return LOCALE_STYLES.get(key)?.stroke ?? "#111";
}

function renderHourDetailPanel({
  hour,
  region,
  day,
  wide,
  locales,
  announceEl,
}) {
  const panel = d3.select(HOUR_DETAIL_SELECTOR);
  if (panel.empty()) return;

  const row = wide.find(r => r.hour === hour);
  if (!row) {
    hideHourDetailPanel();
    return;
  }

  const slices = locales.map((loc) => ({
    key: loc,
    value: Number(row[loc]) || 0,
  }));
  const total = d3.sum(slices, d => d.value);

  panel.attr("hidden", null);
  panel.selectAll("*").remove();

  const closeDetail = () => {
    panel.attr("hidden", true).selectAll("*").remove();
  };

  panel.append("button")
    .attr("type", "button")
    .attr("class", "hour-detail-close")
    .attr("aria-label", "Close hour breakdown")
    .text("×")
    .on("click", () => closeDetail());

  panel.append("h2")
    .attr("class", "hour-detail-heading")
    .attr("id", "hour-detail-heading")
    .text(formatHourAmPm(hour));

  panel.append("p")
    .attr("class", "hour-detail-meta")
    .html(`<strong>Region:</strong> ${region}<br><strong>Day:</strong> ${day}`);

  if (total <= 0) {
    panel.append("p")
      .attr("class", "hour-detail-meta")
      .text("No average order data for this hour.");
    if (announceEl) {
      announceEl.textContent = `Hour breakdown: ${formatHourAmPm(hour)}, ${region}, ${day}. No data.`;
    }
    requestAnimationFrame(() => {
      panel.select(".hour-detail-close").node()?.focus();
    });
    return;
  }

  const pie = d3.pie()
    .sort(null)
    .value(d => d.value);

  const arcGen = d3.arc()
    .innerRadius(0)
    .outerRadius(92)
    .padAngle(0.02);

  const wrap = panel.append("div")
    .attr("class", "hour-detail-svg-wrap");

  const svg = wrap.append("svg")
    .attr("width", 220)
    .attr("height", 220)
    .attr("viewBox", [-110, -110, 220, 220])
    .attr("role", "img")
    .attr("aria-labelledby", "hour-pie-title");

  svg.append("title")
    .attr("id", "hour-pie-title")
    .text(
      `Urban vs suburban share of average orders at ${formatHourAmPm(hour)} on ${day} in ${region}.`,
    );

  appendDetailPatternDefs(svg.append("defs"));

  const gPie = svg.append("g");
  gPie.selectAll("path")
    .data(pie(slices.filter(s => s.value > 0)))
    .join("path")
      .attr("d", arcGen)
      .attr("fill", d => detailPatternFill(d.data.key))
      .attr("stroke", d => detailStrokeForLocale(d.data.key))
      .attr("stroke-width", 1.25);

  const pctFmt = d3.format(".1f");
  const ul = panel.append("ul")
    .attr("class", "hour-detail-pct-list")
    .attr("aria-label", "Share by locale");

  ul.selectAll("li")
    .data(slices)
    .join("li")
    .each(function (d) {
      const pct = (d.value / total) * 100;
      const li = d3.select(this);
      li.append("span")
        .attr("class", "hour-detail-swatch")
        .attr("aria-hidden", "true")
        .style("background", detailPatternFill(d.key))
        .style("border-color", detailStrokeForLocale(d.key));
      li.append("span")
        .text(`${d.key}: ${pctFmt(pct)}% (${formatValueForDetail(d.value)} avg orders)`);
    });

  panel.append("p")
    .attr("class", "hour-detail-hint")
    .text("Percents are each locale's share of combined average orders this hour.");

  if (announceEl) {
    const parts = slices.map((d) => `${d.key} ${pctFmt((d.value / total) * 100)}%`).join(", ");
    announceEl.textContent = `Hour breakdown: ${formatHourAmPm(hour)}, ${region}, ${day}. ${parts}.`;
  }

  requestAnimationFrame(() => {
    panel.select(".hour-detail-close").node()?.focus();
  });
}

function formatValueForDetail(v) {
  return Number.isFinite(v) ? d3.format(".1f")(v) : "N/A";
}

function byLocaleHour(rows) {
  const hours = d3.range(0, 24);
  const locales = uniq(rows.map(d => d.locale)).sort(d3.ascending);

  const rolled = d3.rollup(
    rows,
    v => d3.mean(v, d => d.average_orders),
    d => d.hour,
    d => d.locale
  );

  const wide = hours.map((h) => {
    const row = { hour: h };
    const locMap = rolled.get(h) ?? new Map();
    for (const loc of locales) row[loc] = locMap.get(loc) ?? 0;
    return row;
  });

  return { hours, locales, wide };
}

function buildControls({ regions, days, initialRegion, initialDay, onChange }) {
  const controls = document.querySelector(".controls");
  if (!controls) return;

  controls.querySelectorAll("[data-generated-control='true']").forEach((el) => el.remove());

  const makeSelect = (labelText, id, options, initialValue) => {
    const label = document.createElement("label");
    label.className = "control";
    label.dataset.generatedControl = "true";
    label.setAttribute("for", id);

    const span = document.createElement("span");
    span.className = "label";
    span.textContent = labelText;
    label.appendChild(span);

    const select = document.createElement("select");
    select.id = id;
    for (const opt of options) {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      select.appendChild(o);
    }
    select.value = initialValue;
    label.appendChild(select);

    controls.insertBefore(label, controls.firstChild);
    return select;
  };

  const regionSelect = makeSelect("Region", "select-region", regions, initialRegion);
  const daySelect = makeSelect("Day", "select-day", days, initialDay);

  const notify = () => onChange({ region: regionSelect.value, day: daySelect.value });
  regionSelect.addEventListener("change", notify);
  daySelect.addEventListener("change", notify);

  return { regionSelect, daySelect };
}

function renderRadialChart({ rows, region, day }) {
  hideHourDetailPanel();

  const root = d3.select(CHART_ROOT_SELECTOR);
  root.selectAll("*").remove();

  const filtered = rows.filter(d => d.region === region && d.day === day);
  const { hours, locales: localesUnordered, wide } = byLocaleHour(filtered);

  const preferred = ["Urban", "Suburban"];
  const byLower = new Map(localesUnordered.map(l => [String(l).toLowerCase(), l]));
  const locales = [
    ...preferred.map(p => byLower.get(p.toLowerCase())).filter(Boolean),
    ...localesUnordered.filter(l => !preferred.some(p => p.toLowerCase() === String(l).toLowerCase())),
  ];

  const series = d3.stack()
    .keys(locales)(wide);

  const x = d3.scaleBand()
    .domain(hours)
    .range([0, 2 * Math.PI])
    .align(0);

  const angleOffset = -x.bandwidth() / 2;

  const benchmarkMax = 200;
  const dataMax = d3.max(series, s => d3.max(s, d => d[1])) ?? 0;

  const y = d3.scaleRadial()
    .domain([0, Math.max(benchmarkMax, dataMax)])
    .range([innerRadius, outerRadius]);

  const color = d3.scaleOrdinal()
    .domain(locales)
    .range(d3.schemeTableau10.concat(d3.schemeSet3).slice(0, locales.length))
    .unknown("#ccc");

  const styleForLocale = (loc) => {
    const key = String(loc ?? "").toLowerCase();
    const s = LOCALE_STYLES.get(key);
    return {
      fill: s?.fill ?? color(loc),
      stroke: s?.stroke ?? "#111",
    };
  };

  const patternForLocale = (loc) => {
    const key = String(loc ?? "").toLowerCase();
    if (key === "urban") return "url(#pattern-urban-dots)";
    if (key === "suburban") return "url(#pattern-suburban-diagonal)";
    return styleForLocale(loc).fill;
  };

  const formatValue = (v) => (Number.isFinite(v) ? d3.format(".1f")(v) : "N/A");

  const arc = d3.arc()
    .innerRadius(d => y(d[0]))
    .outerRadius(d => y(d[1]))
    .startAngle(d => x(d.data.hour) + angleOffset)
    .endAngle(d => x(d.data.hour) + x.bandwidth() + angleOffset)
    .padAngle(1.5 / innerRadius)
    .padRadius(innerRadius);

  const chartTitle = `Average Starbucks orders by hour — ${region}, ${day}`;
  const chartDesc = `Radial bar chart showing average customer orders per hour in ${region} locale areas on ${day}. Urban (dot pattern) and Suburban (stripe pattern) locales are stacked. Each segment represents one hour on a 24-hour clock. Click a segment or press Enter or Space when focused to open an urban vs suburban breakdown beside the chart.`;

  const svg = root.append("svg")
    .attr("width", width)
    .attr("viewBox", [-width / 2 - hPad, -(outerRadius + vPadTop), width + hPad * 2, outerRadius * 2 + vPadTop + vPadBot])
    .attr("style", "width: 100%; height: auto; font: 10px sans-serif;")
    .attr("role", "img")
    .attr("aria-labelledby", "chart-svg-title chart-svg-desc");

  svg.append("title").attr("id", "chart-svg-title").text(chartTitle);
  svg.append("desc").attr("id", "chart-svg-desc").text(chartDesc);

  const defs = svg.append("defs");

  defs.append("pattern")
    .attr("id", "pattern-suburban-diagonal")
    .attr("patternUnits", "userSpaceOnUse")
    .attr("width", 8)
    .attr("height", 8)
    .call(p => p.append("rect")
      .attr("width", 8)
      .attr("height", 8)
      .attr("fill", "rgba(233, 200, 81, 0.18)"))
    .call(p => p.append("line")
      .attr("x1", 0).attr("y1", 2).attr("x2", 8).attr("y2", 2)
      .attr("stroke", "rgba(184, 143, 0, 0.75)").attr("stroke-width", 2)
      .attr("shape-rendering", "crispEdges"))
    .call(p => p.append("line")
      .attr("x1", 0).attr("y1", 6).attr("x2", 8).attr("y2", 6)
      .attr("stroke", "rgba(184, 143, 0, 0.75)").attr("stroke-width", 2)
      .attr("shape-rendering", "crispEdges"));

  defs.append("pattern")
    .attr("id", "pattern-urban-dots")
    .attr("patternUnits", "userSpaceOnUse")
    .attr("width", 10)
    .attr("height", 10)
    .call(p => p.append("rect")
      .attr("width", 10).attr("height", 10)
      .attr("fill", "rgba(23, 107, 89, 0.16)"))
    .call(p => p.append("circle")
      .attr("cx", 3).attr("cy", 3).attr("r", 2.3)
      .attr("fill", "rgba(23, 107, 89, 0.75)"))
    .call(p => p.append("circle")
      .attr("cx", 8).attr("cy", 7).attr("r", 2.3)
      .attr("fill", "rgba(23, 107, 89, 0.75)"));

  const yAxis = svg.append("g").attr("text-anchor", "middle");

  yAxis.append("text")
    .attr("y", -y(200))
    .attr("dy", "0")
    .attr("font-weight", 700)
    .attr("font-size", 28)
    .attr("fill", "white")
    .attr("aria-hidden", "true")
    .text(`Average orders in ${region} on ${day}`);

  const tooltip = d3.select("body")
    .selectAll("div.tooltip")
    .data([null])
    .join("div")
      .attr("class", "tooltip")
      .attr("role", "tooltip")
      .style("opacity", 0);

  const showTooltipContent = (d) => {
    const v = d.data[d.key];
    tooltip
      .style("opacity", 1)
      .html(`
        <div><strong>${d.key}</strong></div>
        <div>Hour: ${formatHourAmPm(d.data.hour)}</div>
        <div>Avg orders: ${formatValue(v)}</div>
      `);
  };

  const showTooltip = (event, d) => {
    showTooltipContent(d);
    tooltip.style("left", `${event.clientX}px`).style("top", `${event.clientY}px`);
  };

  const moveTooltip = (event) => {
    tooltip.style("left", `${event.clientX}px`).style("top", `${event.clientY}px`);
  };

  const showTooltipFromFocus = (event, d) => {
    showTooltipContent(d);
    const rect = event.target.getBoundingClientRect();
    tooltip
      .style("left", `${rect.left + rect.width / 2}px`)
      .style("top", `${rect.top + rect.height / 2}px`);
  };

  const hideTooltip = () => {
    tooltip.style("opacity", 0);
  };

  svg.append("g")
    .attr("role", "list")
    .attr("aria-label", "Chart segments")
    .selectAll("g")
    .data(series)
    .join("g")
      .attr("role", "listitem")
      .attr("fill", d => patternForLocale(d.key))
      .attr("stroke", d => styleForLocale(d.key).stroke)
      .attr("stroke-width", 1.25)
      .attr("stroke-opacity", 1)
    .selectAll("path")
    .data(S => S.map(d => (d.key = S.key, d)))
    .join("path")
      .attr("d", arc)
      .attr("tabindex", "0")
      .attr("role", "img")
      .attr("aria-label", d => {
        const v = d.data[d.key];
        const hour = String(d.data.hour).padStart(2, "0");
        return `${d.key}, ${hour}:00, average ${formatValue(v)} orders`;
      })
      .on("mouseenter", showTooltip)
      .on("mousemove", moveTooltip)
      .on("mouseleave", hideTooltip)
      .on("focus", showTooltipFromFocus)
      .on("blur", hideTooltip)
      .on("click", (event, d) => {
        event.stopPropagation();
        renderHourDetailPanel({
          hour: d.data.hour,
          region,
          day,
          wide,
          locales,
          announceEl: document.getElementById("chart-announce"),
        });
      })
      .on("keydown", (event, d) => {
        if ((event.key === "Enter" || event.key === " ") && !event.repeat) {
          event.preventDefault();
          showTooltipFromFocus(event, d);
          renderHourDetailPanel({
            hour: d.data.hour,
            region,
            day,
            wide,
            locales,
            announceEl: document.getElementById("chart-announce"),
          });
        }
      });

  svg.append("g")
      .attr("text-anchor", "middle")
      .attr("aria-hidden", "true")
    .selectAll("g")
    .data(hours)
    .join("g")
      .attr("transform", h => `
        rotate(${((x(h) + x.bandwidth() / 2 + angleOffset) * 180 / Math.PI - 90)})
        translate(${innerRadius},0)
      `)
      .call(g => g.append("line")
        .attr("x2", -6)
        .attr("stroke", "white"))
      .call(g => g.append("g")
        .attr("transform", `translate(${hourLabelRadius - innerRadius},0)`)
        .append("text")
          .attr("transform", (h) => {
            const deg = (x(h) + x.bandwidth() / 2 + angleOffset) * 180 / Math.PI - 90;
            return `rotate(${-deg})`;
          })
          .attr("dy", "0.32em")
          .attr("font-size", 14)
          .text(h => (h % 2 === 0 ? String(h) : ""))
          .attr("fill", "white"));

  const legend = svg.append("g")
    .attr("transform", `translate(${-width / 2 - hPad + 24},${-(outerRadius + vPadTop) + 24})`)
    .attr("role", "list")
    .attr("aria-label", "Legend");

  legend.selectAll("g")
    .data(locales)
    .join("g")
      .attr("transform", (d, i) => `translate(0,${i * 35})`)
      .attr("role", "listitem")
      .call(g => g.append("rect")
        .attr("width", 30)
        .attr("height", 30)
        .attr("fill", d => patternForLocale(d))
        .attr("stroke", d => styleForLocale(d).stroke)
        .attr("stroke-width", 1)
        .attr("aria-hidden", "true"))
      .call(g => g.append("text")
        .attr("x", 35)
        .attr("y", 15)
        .attr("dy", "0.35em")
        .text(d => d))
        .attr("fill", "white")
        .attr("font-size", 24);

  const peakHour = wide.reduce((best, row) => {
    const total = locales.reduce((s, l) => s + (row[l] ?? 0), 0);
    return total > best.total ? { hour: row.hour, total } : best;
  }, { hour: 0, total: 0 });

  const announce = document.getElementById("chart-announce");
  if (announce) {
    announce.textContent = `Chart updated: ${region} region, ${day}. Peak orders around ${String(peakHour.hour).padStart(2, "0")}:00.`;
  }
}

async function main() {
  const rows = await d3.csv(DATA_URL, (d) => ({
    locale: d.locale,
    region: d.region,
    day: d.day,
    hour: d.hour === "" ? NaN : +d.hour,
    average_orders: d.average_orders === "" ? NaN : +d.average_orders,
  }));

  const validRows = rows.filter(d =>
    d.locale && d.region && d.day &&
    Number.isFinite(d.hour) &&
    Number.isFinite(d.average_orders)
  );

  const regions = uniq(validRows.map(d => d.region)).sort(d3.ascending);
  const days = uniq(validRows.map(d => d.day))
    .sort((a, b) => (dayOrder.indexOf(a) - dayOrder.indexOf(b)));

  const state = {
    region: regions[0] ?? "",
    day: days[0] ?? "",
  };

  buildControls({
    regions,
    days,
    initialRegion: state.region,
    initialDay: state.day,
    onChange: (next) => {
      state.region = next.region;
      state.day = next.day;
      renderRadialChart({ rows: validRows, region: state.region, day: state.day });
    },
  });

  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape") return;
    const p = document.querySelector(HOUR_DETAIL_SELECTOR);
    if (!p || p.hidden) return;
    hideHourDetailPanel();
  });

  renderRadialChart({ rows: validRows, region: state.region, day: state.day });
}

main().catch((err) => {
  console.error(err);
  const chartEl = document.querySelector(CHART_ROOT_SELECTOR);
  if (chartEl) {
    const msg = document.createElement("p");
    msg.className = "error";
    msg.setAttribute("role", "alert");
    msg.textContent = `Failed to load data: ${String(err)}`;
    chartEl.appendChild(msg);
  }
});
