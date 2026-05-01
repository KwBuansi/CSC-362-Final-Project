// Radial (stacked) bar chart for Starbucks order volume.
// Angle = hour (0–23), stacked radial bars = locales, magnitude = average_orders.

const CHART_ROOT_SELECTOR = "#chart";
const META_SELECTOR = "#meta";
const DATA_URL = "./data/cleaned_data.csv";

const width = 1100;
const height = width;
const innerRadius = 200;
const outerRadius = Math.min(width, height) / 2;
const chartTopPadding = 80;

const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function uniq(arr) {
  return Array.from(new Set(arr));
}

function byLocaleHour(rows) {
  // Returns {hours: number[], locales: string[], wide: Array<{hour, [locale]: value}>}
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

  const makeSelect = (labelText, options, initialValue) => {
    const label = document.createElement("label");
    label.className = "control";
    label.dataset.generatedControl = "true";

    const span = document.createElement("span");
    span.className = "label";
    span.textContent = labelText;
    label.appendChild(span);

    const select = document.createElement("select");
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

  const regionSelect = makeSelect("Region", regions, initialRegion);
  const daySelect = makeSelect("Day", days, initialDay);

  const notify = () => onChange({ region: regionSelect.value, day: daySelect.value });
  regionSelect.addEventListener("change", notify);
  daySelect.addEventListener("change", notify);

  return { regionSelect, daySelect };
}

function renderRadialChart({ rows, region, day }) {
  const root = d3.select(CHART_ROOT_SELECTOR);
  root.selectAll("*").remove();

  const filtered = rows.filter(d => d.region === region && d.day === day);
  const { hours, locales: localesUnordered, wide } = byLocaleHour(filtered);

  // Prefer a stable, semantic stack order when present.
  // In d3.stack, earlier keys are closer to the baseline (inner radius here).
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

  // Rotate slightly so hour 0 is exactly vertical (12 o'clock).
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

  const localeStyles = new Map([
    // Transparent fills + opaque outlines (requested).
    ["urban", { fill: "rgba(23, 107, 89, 0.35)", stroke: "#1e8e4c" }],      // green
    ["suburban", { fill: "rgba(233, 200, 81, 0.34)", stroke: "#b88f00" }],   // yellow
  ]);
  const styleForLocale = (loc) => {
    const key = String(loc ?? "").toLowerCase();
    const s = localeStyles.get(key);
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

  const svg = root.append("svg")
    .attr("width", width)
    .attr("height", height)
    // Add extra top padding so the 200 label + title fit.
    .attr("viewBox", [-width / 2, -height / 2 - chartTopPadding, width, height + chartTopPadding])
    .attr("style", "width: 100%; height: auto; font: 10px sans-serif;");

  // Pattern fills (Urban = dots, Suburban = straight lines)
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
    // Use straight horizontal stripes to avoid visible tiled seams.
    .call(p => p.append("line")
      .attr("x1", 0)
      .attr("y1", 2)
      .attr("x2", 8)
      .attr("y2", 2)
      .attr("stroke", "rgba(184, 143, 0, 0.75)")
      .attr("stroke-width", 2)
      .attr("shape-rendering", "crispEdges"))
    .call(p => p.append("line")
      .attr("x1", 0)
      .attr("y1", 6)
      .attr("x2", 8)
      .attr("y2", 6)
      .attr("stroke", "rgba(184, 143, 0, 0.75)")
      .attr("stroke-width", 2)
      .attr("shape-rendering", "crispEdges"));

  defs.append("pattern")
    .attr("id", "pattern-urban-dots")
    .attr("patternUnits", "userSpaceOnUse")
    .attr("width", 10)
    .attr("height", 10)
    .call(p => p.append("rect")
      .attr("width", 10)
      .attr("height", 10)
      .attr("fill", "rgba(23, 107, 89, 0.16)"))
    .call(p => p.append("circle")
      .attr("cx", 3)
      .attr("cy", 3)
      .attr("r", 2.3)
      .attr("fill", "rgba(23, 107, 89, 0.75)"))
    .call(p => p.append("circle")
      .attr("cx", 8)
      .attr("cy", 7)
      .attr("r", 2.3)
      .attr("fill", "rgba(23, 107, 89, 0.75)"));

  // Radial grid + labels (y axis) — draw BEFORE bars so it sits behind them.
  // Always draw exactly 4 benchmark circles at: 50, 100, 150, 200.
  const yTicks = [50, 100, 150, 200];
  const yAxis = svg.append("g").attr("text-anchor", "middle");

  // Chart title (above the 200 benchmark label)
  yAxis.append("text")
    .attr("y", -y(200))
    .attr("dy", "-2.2em")
    .attr("font-weight", 700)
    .attr("font-size", 28)
    .attr("fill", "white")
    .text(`${region} · ${day} — Average orders`);

  yAxis.selectAll("g")
    .data(yTicks)
    .join("g")
      .attr("fill", "none")
      .call(g => g.append("circle")
        .attr("stroke", "white")
        .attr("stroke-opacity", 0.25)
        .attr("r", y))
      .call(g => g.append("text")
        .attr("y", d => -y(d))
        .attr("dy", "0.35em")
        .attr("stroke", "#c5c5c5")
        .attr("stroke-width", 2)
        .attr("font-size", 20)
        .text(d3.format("~s")));

  const tooltip = d3.select("body")
    .selectAll("div.tooltip")
    .data([null])
    .join("div")
      .attr("class", "tooltip")
      .style("opacity", 0);

  const showTooltip = (event, d) => {
    const v = d.data[d.key];
    const hour = String(d.data.hour).padStart(2, "0");
    tooltip
      .style("opacity", 1)
      .html(`
        <div><strong>${d.key}</strong></div>
        <div>Hour: ${hour}:00</div>
        <div>Avg orders: ${formatValue(v)}</div>
      `);
    moveTooltip(event);
  };

  const moveTooltip = (event) => {
    tooltip
      .style("left", `${event.clientX}px`)
      .style("top", `${event.clientY}px`);
  };

  const hideTooltip = () => {
    tooltip.style("opacity", 0);
  };

  // Stacked arcs
  svg.append("g")
    .selectAll("g")
    .data(series)
    .join("g")
      .attr("fill", d => patternForLocale(d.key))
      .attr("stroke", d => styleForLocale(d.key).stroke)
      .attr("stroke-width", 1.25)
      .attr("stroke-opacity", 1)
    .selectAll("path")
    .data(S => S.map(d => (d.key = S.key, d)))
    .join("path")
      .attr("d", arc)
      .on("mouseenter", showTooltip)
      .on("mousemove", moveTooltip)
      .on("mouseleave", hideTooltip);

  // Hour ticks (x axis) — draw AFTER bars so labels stay on top.
  svg.append("g")
      .attr("text-anchor", "middle")
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
      .call(g => g.append("text")
        .attr("transform", h => ((x(h) + x.bandwidth() / 2 + angleOffset + Math.PI / 2) % (2 * Math.PI)) < Math.PI
          ? "rotate(90)translate(0,24)"
          : "rotate(-90)translate(0,-14)")
        .attr("font-size", 18)
        .text(h => (h % 2 === 0 ? String(h) : "")))
        .attr("fill", "white");

  // Legend
  svg.append("g")
    .attr("transform", `translate(${-width / 2 + 24},${-height / 2 + 24})`)
    .selectAll("g")
    .data(locales)
    .join("g")
      .attr("transform", (d, i) => `translate(0,${i * 35})`)
      .call(g => g.append("rect")
        .attr("width", 30)
        .attr("height", 30)
        .attr("fill", (d) => patternForLocale(d))
        .attr("stroke", d => styleForLocale(d).stroke)
        .attr("stroke-width", 1))
      .call(g => g.append("text")
        .attr("x", 35)
        .attr("y", 15)
        .attr("dy", "0.35em")
        .text(d => d))
        .attr("fill", "white")
        .attr("font-size", 24);

  root.attr("aria-label", `Radial chart of average orders by hour for ${region} on ${day}.`);
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

  renderRadialChart({ rows: validRows, region: state.region, day: state.day });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  const meta = document.querySelector(META_SELECTOR);
  if (meta) meta.textContent = `Failed to load data: ${String(err)}`;
});
