const DATA_PATH = "./data/cleaned_data.csv";
const DEFAULT_REGION = "West";
const DEFAULT_DAY = "Monday";
const LOCALES = ["Urban", "Suburban"];
const HOURS = d3.range(24);

const chart = d3.select("#chart");
const controls = d3.select(".controls .control");
const meta = d3.select("#meta");

function hourLabel(hour) {
  if (hour === 0) return "12am";
  if (hour < 12) return `${hour}am`;
  if (hour === 12) return "12pm";
  return `${hour - 12}pm`;
}

function buildHourlyData(data, region, day) {
  return HOURS.map((hour) => {
    const row = { hour };

    for (const locale of LOCALES) {
      row[locale] = d3.sum(
        data,
        (d) =>
          d.region === region && d.day === day && d.locale === locale && d.hour === hour
            ? d.orders
            : 0,
      );
    }

    return row;
  });
}

function renderChart(data, selectedRegion, selectedDay) {
  chart.selectAll("*").remove();

  const width = 928;
  const height = width;
  const innerRadius = 150;
  const outerRadius = Math.min(width, height) / 2 - 48;
  const hourlyData = buildHourlyData(data, selectedRegion, selectedDay);
  const series = d3.stack().keys(LOCALES)(hourlyData);
  const maxOrders = d3.max(series, (localeSeries) => d3.max(localeSeries, (d) => d[1])) || 0;

  const x = d3
    .scaleBand()
    .domain(HOURS)
    .range([0, 2 * Math.PI])
    .align(0);

  const y = d3.scaleRadial().domain([0, maxOrders]).range([innerRadius, outerRadius]);

  const color = d3
    .scaleOrdinal()
    .domain(LOCALES)
    .range(["#00704A", "#D4A017"]);

  const arc = d3
    .arc()
    .innerRadius((d) => y(d[0]))
    .outerRadius((d) => y(d[1]))
    .startAngle((d) => x(d.data.hour))
    .endAngle((d) => x(d.data.hour) + x.bandwidth())
    .padAngle(0.012)
    .padRadius(innerRadius);

  const formatValue = d3.format(",");
  const svg = chart
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [-width / 2, -height / 2, width, height])
    .attr("role", "img")
    .attr("aria-label", `${selectedRegion} ${selectedDay} hourly order counts by locale`);

  svg
    .append("g")
    .selectAll("g")
    .data(series)
    .join("g")
    .attr("fill", (d) => color(d.key))
    .selectAll("path")
    .data((localeSeries) => localeSeries.map((d) => ({ ...d, locale: localeSeries.key })))
    .join("path")
    .attr("d", arc)
    .append("title")
    .text((d) => {
      const localeOrders = d.data[d.locale];
      const totalOrders = d.data.Urban + d.data.Suburban;
      return [
        `${selectedRegion}, ${selectedDay}, ${hourLabel(d.data.hour)}`,
        `${d.locale}: ${formatValue(localeOrders)} orders`,
        `Total: ${formatValue(totalOrders)} orders`,
      ].join("\n");
    });

  svg
    .append("g")
    .attr("text-anchor", "middle")
    .selectAll("g")
    .data(HOURS)
    .join("g")
    .attr(
      "transform",
      (hour) => `
        rotate(${((x(hour) + x.bandwidth() / 2) * 180) / Math.PI - 90})
        translate(${innerRadius - 8},0)
      `,
    )
    .call((g) => g.append("line").attr("x2", -6).attr("stroke", "#26332d"))
    .call((g) =>
      g
        .append("text")
        .attr("transform", (hour) =>
          (x(hour) + x.bandwidth() / 2 + Math.PI / 2) % (2 * Math.PI) < Math.PI
            ? "rotate(90)translate(0,18)"
            : "rotate(-90)translate(0,-11)",
        )
        .attr("font-size", 11)
        .text((hour) => hourLabel(hour)),
    );

  const ticks = y.ticks(5).filter((tick) => tick > 0);

  svg
    .append("g")
    .attr("text-anchor", "middle")
    .call((g) =>
      g
        .selectAll("g")
        .data(ticks)
        .join("g")
        .attr("fill", "none")
        .call((tick) =>
          tick.append("circle").attr("stroke", "#26332d").attr("stroke-opacity", 0.25).attr("r", y),
        )
        .call((tick) =>
          tick
            .append("text")
            .attr("y", (d) => -y(d))
            .attr("dy", "0.35em")
            .attr("stroke", "#fff")
            .attr("stroke-width", 4)
            .attr("fill", "#26332d")
            .text((d) => formatValue(d))
            .clone(true)
            .attr("stroke", "none"),
        ),
    );

  const legend = svg
    .append("g")
    .attr("font-size", 13)
    .attr("text-anchor", "start")
    .selectAll("g")
    .data(LOCALES)
    .join("g")
    .attr("transform", (d, i) => `translate(-55,${i * 24 - 12})`);

  legend.append("rect").attr("width", 16).attr("height", 16).attr("fill", color);
  legend
    .append("text")
    .attr("x", 24)
    .attr("y", 8)
    .attr("dy", "0.35em")
    .text((d) => d);

  const total = d3.sum(hourlyData, (d) => d.Urban + d.Suburban);
  meta.text(`${selectedRegion}, ${selectedDay}: ${formatValue(total)} orders`);
}

d3.csv(DATA_PATH, (d) => ({
  locale: d.locale,
  region: d.region,
  day: d.day,
  hour: +d.hour,
  orders: +d.average_orders,
}))
  .then((data) => {
    const regions = Array.from(new Set(data.map((d) => d.region))).sort();
    const days = Array.from(new Set(data.map((d) => d.day))).sort(
      (a, b) =>
        [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ].indexOf(a) -
        [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ].indexOf(b),
    );
    const defaultRegion = regions.includes(DEFAULT_REGION) ? DEFAULT_REGION : regions[0];
    const defaultDay = days.includes(DEFAULT_DAY) ? DEFAULT_DAY : days[0];

    function updateChart() {
      renderChart(data, regionSelect.property("value"), daySelect.property("value"));
    }

    controls.html("");
    const regionControl = controls.append("span").attr("class", "filter");
    regionControl.append("label").attr("class", "label").attr("for", "regionSelect").text("Region");

    const regionSelect = regionControl
      .append("select")
      .attr("id", "regionSelect")
      .attr("name", "region");

    regionSelect
      .selectAll("option")
      .data(regions)
      .join("option")
      .attr("value", (d) => d)
      .property("selected", (d) => d === defaultRegion)
      .text((d) => d);

    const dayControl = controls.append("span").attr("class", "filter");
    dayControl.append("label").attr("class", "label").attr("for", "daySelect").text("Day");

    const daySelect = dayControl.append("select").attr("id", "daySelect").attr("name", "day");

    daySelect
      .selectAll("option")
      .data(days)
      .join("option")
      .attr("value", (d) => d)
      .property("selected", (d) => d === defaultDay)
      .text((d) => d);

    regionSelect.on("change", updateChart);
    daySelect.on("change", updateChart);
    renderChart(data, defaultRegion, defaultDay);
  })
  .catch((error) => {
    console.error(error);
    chart.text("Unable to load the cleaned order data.");
  });
