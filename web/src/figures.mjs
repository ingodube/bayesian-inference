// Presentation-only binding of R output into Python-authored Plotly definitions.
export const array = (value) =>
  value == null ? [] : Array.isArray(value) ? value : [value];
const read = (object, path) => path.split(".").reduce((v, k) => v?.[k], object);
export function bindFigure(template, bindings, source) {
  const f = structuredClone(template);
  for (const [path, key] of Object.entries(bindings)) {
    const parts = path.split(".");
    const leaf = parts.pop();
    let target = f;
    for (const part of parts) target = target[part];
    target[leaf] = array(read(source, key));
  }
  return f;
}
export function posteriorFigure(definitions, bindings, panel, expanded) {
  const f = bindFigure(definitions.posterior, bindings.posterior, panel);
  f.layout.xaxis.title = { text: panel.target };
  f.layout.xaxis.range = expanded ? panel.expanded : panel.focus;
  f.data[0].name = `${Math.round(panel.summary.interval.level * 100)}% credible interval`;
  const height = Math.max(...panel.curve.y);
  const range = f.layout.xaxis.range;
  const visibleHeights = [
    ...panel.curve.x.map((x, i) =>
      x >= range[0] && x <= range[1] ? panel.curve.y[i] : 0,
    ),
    ...array(panel.prior_curve?.x).map((x, i) =>
      x >= range[0] && x <= range[1] ? panel.prior_curve.y[i] : 0,
    ),
  ];
  f.layout.yaxis.range = [0, Math.max(...visibleHeights) * 1.08];
  const mode = array(panel.summary.mode.values);
  const marks = [
    ["truth", panel.truth, "True generating value"],
    ["mean", panel.summary.mean.value, "Mean"],
    ["median", panel.summary.median.value, "Median"],
    ...mode.map((v) => ["mode", v, "Mode"]),
  ];
  const groups = [];
  for (const [kind, value, label] of marks) {
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    const group = groups.find(
      (g) => (g.kind === "truth") === (kind === "truth") &&
        Math.abs(g.value - value) <= 1e-9 * Math.max(1, Math.abs(value)),
    );
    if (group) group.labels.push(label);
    else groups.push({ kind, value, labels: [label] });
  }
  for (const g of groups) {
    const trace = structuredClone(definitions.markers[g.kind]);
    trace.x = [g.value, g.value];
    trace.y = [0, height * 0.92];
    trace.name = `${g.labels.join(" / ")}: ${Number(g.value.toPrecision(5))}`;
    f.data.push(trace);
  }
  return f;
}
