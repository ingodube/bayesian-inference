import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import Plotly from "plotly.js-basic-dist-min";
import { catalog, priorFamily } from "./catalog";
import { compute, restartEngine } from "./engine";
import { array, bindFigure, posteriorFigure } from "./figures.mjs";
import { formatNumber as fmt } from "./format.mjs";
import type { Model, Field, Panel, Request, Result, Summary } from "./types";
import "./style.css";

const base = import.meta.env.BASE_URL;
let assets: Promise<any>;
function definitions() {
  return (assets ??= Promise.all(
    ["figures.json", "bindings.json", "manifest.json"].map((f) =>
      fetch(base + f).then((r) => {
        if (!r.ok) throw Error("Presentation assets could not be loaded.");
        return r.json();
      }),
    ),
  ));
}
function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function NumberField({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="field">
      <span>{field.label}</span>
      <input
        type="number"
        required
        value={Number.isNaN(value) ? "" : value}
        min={field.min}
        max={field.max}
        step={field.step ?? "any"}
        onChange={(e) => onChange(e.target.valueAsNumber)}
      />
      {field.help && <small>{field.help}</small>}
    </label>
  );
}
function Chart({ figure }: { figure: any }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const el = ref.current!;
    let active = true;
    Plotly.react(el, figure.data, figure.layout, {
      responsive: true,
      displayModeBar: false,
      displaylogo: false,
      scrollZoom: false,
    }).catch((e) => {
      if (active) setError(String(e));
    });
    const observer = new ResizeObserver(() => {
      if (active && el.isConnected && el.offsetWidth > 0 && (el as any).data) {
        // Plotly defers resize; a model change may unmount the plot before it runs.
        void Promise.resolve(Plotly.Plots.resize(el)).catch(() => {});
      }
    });
    observer.observe(el);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [figure]);
  useEffect(() => {
    const el = ref.current;
    return () => { if (el) Plotly.purge(el); };
  }, []);
  return (
    <>
      {error && <p role="alert">{error}</p>}
      <div
        ref={ref}
        className="chart"
        aria-label="Interactive statistical chart"
      />
    </>
  );
}
function modeText(s: Summary) {
  const vals = array(s.mode.values);
  if (s.mode.status === "all_values") return "Every value in (0, 1)";
  return (
    vals.map(fmt).join(" and ") +
    (s.mode.status.includes("boundary") ? " (boundary)" : "")
  );
}
function SummaryRow({ name, s }: { name: string; s: Summary }) {
  return (
    <tr>
      <th>{name}</th>
      <td title={s.mean.reason}>{fmt(s.mean.value)}</td>
      <td title={s.median.reason}>{s.median.status === "numerical_limit" ? "Beyond numeric range" : fmt(s.median.value)}</td>
      <td>{modeText(s)}</td>
      <td>
        {s.interval.lower == null ? "Beyond numeric range" : fmt(s.interval.lower)} – {s.interval.upper == null ? "Beyond numeric range" : fmt(s.interval.upper)}
      </td>
    </tr>
  );
}
function PosteriorPanel({
  panel,
  defs,
  bindings,
}: {
  panel: Panel;
  defs: any;
  bindings: any;
}) {
  const [expanded, setExpanded] = useState(false);
  const figure = posteriorFigure(defs, bindings, panel, expanded);
  return (
    <article className="posterior-panel">
      <div className="plot-heading">
        <h3>{panel.target}</h3>
        <label className="check">
          <input
            type="checkbox"
            checked={expanded}
            onChange={(e) => setExpanded(e.target.checked)}
          />{" "}
          Include prior range
        </label>
      </div>
      <Chart figure={figure} />
      {!expanded && (panel.truth < panel.focus[0] || panel.truth > panel.focus[1]) && <p className="notice">True generating value: {fmt(panel.truth)} — outside the posterior-focused view. Select “Include prior range” to include it.</p>}
      {panel.plot_note && <p className="notice">{panel.plot_note}</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Distribution</th>
              <th>Mean</th>
              <th>Median</th>
              <th>Mode</th>
              <th>
                {Math.round(panel.summary.interval.level * 100)}% equal-tailed
                interval
              </th>
            </tr>
          </thead>
          <tbody>
            {panel.prior_summary && (
              <SummaryRow name="Prior" s={panel.prior_summary} />
            )}
            <SummaryRow name="Posterior" s={panel.summary} />
          </tbody>
        </table>
      </div>
      <p className="small-note">
        Posterior interval width:{" "}
        <strong>{fmt(panel.summary.interval.width)}</strong>.{" "}
        {panel.boundary_note}
      </p>
      <details>
        <summary>Distribution parameters and existence of moments</summary>
        <p>
          Posterior: <code>{JSON.stringify(panel.posterior)}</code>
        </p>
        {panel.prior && (
          <p>
            Prior: <code>{JSON.stringify(panel.prior)}</code>
          </p>
        )}
        <p>
          Posterior variance: {fmt(panel.summary.variance.value)}.{" "}
          {panel.summary.variance.value === null &&
            panel.summary.variance.reason}
        </p>
        {panel.summary.mean.value === null && (
          <p>{panel.summary.mean.reason}</p>
        )}
        <p>
          Gamma uses shape / rate. Inverse-Gamma uses shape / scale. A Student-t
          scale is not its standard deviation.
        </p>
      </details>
    </article>
  );
}
function Methodology() {
  return (
    <section className="method">
      <h2>How this laboratory works</h2>
      <div className="method-grid">
        <div>
          <h3>From belief to evidence</h3>
          <p>
            A prior describes uncertainty about a parameter before seeing these
            data. The likelihood describes how the observed data depend on that
            parameter. Their product, normalized, gives the posterior.
          </p>
          <p className="equation">posterior ∝ likelihood × prior</p>
          <p>
            Here, conjugate families give analytic posterior updates. R computes
            all statistical quantities; numerical quantile functions give
            medians and credible limits. No MCMC is used.
          </p>
        </div>
        <div>
          <h3>A controlled experiment</h3>
          <p>
            Every sample is simulated. The true generating value is available
            for learning, but only parameters declared known are used as known
            quantities in inference. Known values equal their generating values
            in this experiment.
          </p>
          <p>
            A sequence of 2,500 observations is generated from a recorded seed.
            Changing n takes its first n values. Changing the prior keeps
            exactly the same data.
          </p>
        </div>
        <div>
          <h3>Read intervals carefully</h3>
          <p>
            A 95% credible interval contains 95% posterior probability under the
            chosen model and prior. This app uses equal-tailed intervals. In the
            joint Normal model each displayed interval is marginal, not a 95%
            joint region.
          </p>
          <p>
            A wider prior is not universally noninformative. A strong
            conflicting prior can influence inference even with many
            observations. A larger realized sample need not give a closer
            estimate every time.
          </p>
        </div>
        <div>
          <h3>Conventions and boundaries</h3>
          <p>
            Gamma uses shape and rate; Inverse-Gamma uses shape and scale.
            Geometric data count failures before the first success. Binomial n
            counts observations, each with m trials. Rayleigh location is zero.
          </p>
          <p>
            Reference priors can be improper and cannot then be drawn as
            normalized densities. Estimates require a proper posterior; some
            proper distributions still have undefined means or variances.
          </p>
          <p>
            <a
              href="https://www.cs.ubc.ca/~murphyk/Papers/bayesGauss.pdf"
              target="_blank"
              rel="noreferrer"
            >
              Normal conjugate analysis ↗
            </a>{" "}
            ·{" "}
            <a
              href="https://stat.ethz.ch/R-manual/R-devel/library/stats/html/Distributions.html"
              target="_blank"
              rel="noreferrer"
            >
              R distributions ↗
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
function App() {
  const [model, setModel] = useState<Model | "">("");
  const [gen, setGen] = useState<Record<string, number>>({});
  const [mode, setMode] = useState("");
  const [n, setN] = useState(100);
  const [seed, setSeed] = useState(2026);
  const [generated, setGenerated] = useState(false);
  const [family, setFamily] = useState("");
  const [h, setH] = useState({ a: 2, b: 2, m: 0, v: 10, k: 1 });
  const [level, setLevel] = useState(0.95);
  const [scale, setScale] = useState("variance");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [presentation, setPresentation] = useState<any>(null);
  const [method, setMethod] = useState(false);
  const [reference, setReference] = useState(false);
  const ticket = useRef(0);
  useEffect(() => {
    definitions()
      .then(setPresentation)
      .catch((e) => setError(e.message));
  }, []);
  const familyLabel = model ? priorFamily(model, mode) : "";
  useEffect(() => {
    const id = ++ticket.current;
    if (!generated || !model || !mode) {
      setBusy(false);
      return;
    }
    setBusy(true);
    setError("");
    const timer = setTimeout(() => {
      const request: Request = {
        model,
        gen,
        mode,
        n,
        seed,
        level,
        prior: { family, ...h },
        scale,
      };
      const timeout = setTimeout(() => {
        if (ticket.current === id) {
          ticket.current++;
          restartEngine();
          setBusy(false);
          setError("The R engine took too long. Try again to restart it.");
        }
      }, 60000);
      compute(request)
        .then((next) => {
          if (ticket.current !== id) return;
          if (next.status === "error") {
            setResult(null);
            setError(next.message ?? "The calculation failed.");
          } else setResult(next);
        })
        .catch((e) => {
          if (ticket.current === id) {
            setResult(null);
            setError(String(e.message ?? e));
          }
        })
        .finally(() => {
          clearTimeout(timeout);
          if (ticket.current === id) setBusy(false);
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [model, gen, mode, n, seed, generated, family, h, level, scale]);
  function choose(value: Model | "") {
    ticket.current++;
    setModel(value);
    setGen(
      value
        ? Object.fromEntries(catalog[value].fields.map((f) => [f.key, f.value]))
        : {},
    );
    setMode("");
    setGenerated(false);
    setFamily("");
    setResult(null);
    setError("");
    setReference(false);
    setH({ a: 2, b: 2, m: 0, v: 10, k: 1 });
    setScale("variance");
  }
  function reset() {
    choose("");
    setN(100);
    setSeed(2026);
    setLevel(0.95);
  }
  function editGenerator(key: string, value: number) {
    setGen({ ...gen, [key]: value });
    setGenerated(false);
    setResult(null);
    setError("");
  }
  function chooseMode(value: string) {
    setMode(value);
    setFamily("");
    setResult(null);
  }
  function priorEdit(key: string, value: number) {
    setH({ ...h, [key]: value });
  }
  const likelihoodSelect = (
    <label className="field">
      <span>Likelihood</span>
      <select
        aria-label="Choose a likelihood"
        value={model}
        onChange={(e) => choose(e.target.value as Model | "")}
      >
        <option value="">Choose a likelihood</option>
        <optgroup label="Discrete">
          {(["bernoulli", "binomial", "geometric", "poisson"] as Model[]).map(
            (k) => (
              <option key={k} value={k}>
                {catalog[k].label}
              </option>
            ),
          )}
        </optgroup>
        <optgroup label="Continuous">
          {(["normal", "exponential", "gamma", "rayleigh"] as Model[]).map(
            (k) => (
              <option key={k} value={k}>
                {catalog[k].label}
              </option>
            ),
          )}
        </optgroup>
      </select>
    </label>
  );
  let observedFigure: any = null;
  if (result && presentation) {
    observedFigure = bindFigure(
      presentation[0].observed,
      presentation[1].observed,
      result.observed,
    );
    observedFigure.layout.yaxis.title = {
      text:
        result.observed.discrete && !result.observed.note.includes("grouped")
          ? "Probability"
          : "Density",
    };
    if (!result.observed.discrete) observedFigure.data[1].mode = "lines";
  }
  const ready = result && !busy && !error;
  return (
    <>
      <header className="site-header">
        <a
          className="brand"
          href={base}
          onClick={(e) => {
            e.preventDefault();
            reset();
          }}
        >
          <span className="brand-mark">β</span>
          <span>
            Bayesian <strong>Prior Lab</strong>
          </span>
        </a>
        <nav aria-label="Main navigation">
          <button
            className={method ? "text-button active" : "text-button"}
            onClick={() => setMethod(!method)}
          >
            Methodology
          </button>
          <a
            href="https://github.com/ingodube/bayesian-inference"
            target="_blank"
            rel="noreferrer"
          >
            GitHub ↗
          </a>
        </nav>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <p className="eyebrow">
              An interactive introduction to Bayesian inference
            </p>
            <h1>How much does your prior matter?</h1>
            <p className="lead">
              Build a model. Observe the data. Watch your beliefs update.
            </p>
          </div>
          {model && (
            <button className="text-button reset" onClick={reset}>
              Reset experiment ↺
            </button>
          )}
        </div>
        {method && <Methodology />}
        {!model ? (
          <section className="welcome">
            <div className="start-rule" />
            <p className="step-label">START WITH A MODEL</p>
            <h2>Your experiment begins here.</h2>
            <p>
              Choose a distribution, generate a sample, then explore how a prior
              shapes what you learn.
            </p>
            <div className="initial-select">{likelihoodSelect}</div>
            <p className="small-note">
              No coding required. All calculations run on your device.
            </p>
          </section>
        ) : (
          <div className="workspace">
            <aside className="controls" aria-label="Experiment settings">
              <section>
                <p className="step-label">01 / THE DATA MODEL</p>
                {likelihoodSelect}
                <p className="help">{catalog[model].description}</p>
                {catalog[model].fields.map((f) => (
                  <NumberField
                    key={model + f.key}
                    field={f}
                    value={gen[f.key]}
                    onChange={(v) => editGenerator(f.key, v)}
                  />
                ))}
                <label className="field">
                  <span>What is known in the inference?</span>
                  <select
                    aria-label="What is known in the inference?"
                    value={mode}
                    onChange={(e) => chooseMode(e.target.value)}
                  >
                    <option value="">Declare parameter knowledge</option>
                    {model === "normal" ? (
                      <>
                        <option value="mean">
                          Variance known · infer mean
                        </option>
                        <option value="variance">
                          Mean known · infer variance
                        </option>
                        <option value="both">Neither known · infer both</option>
                        <option value="known">Both parameters known</option>
                      </>
                    ) : (
                      <>
                        <option value="unknown">
                          {model === "gamma"
                            ? "Shape known · infer rate"
                            : `Infer ${catalog[model].parameter}`}
                        </option>
                        <option value="known">All parameters known</option>
                      </>
                    )}
                  </select>
                </label>
                {model === "gamma" && (
                  <small>Unknown shape is outside this conjugate model.</small>
                )}
                {mode && (
                  <p className="help">
                    Known parameters use their generating values. Undeclared
                    parameters are not supplied as known values.
                  </p>
                )}
              </section>
              <section>
                <p className="step-label">02 / THE SAMPLE</p>
                <label className="field">
                  <span>Sample size n</span>
                  <select
                    aria-label="Sample size n"
                    value={n}
                    onChange={(e) => setN(+e.target.value)}
                  >
                    {[20, 100, 500, 1000, 2500].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <details>
                  <summary>Reproducibility options</summary>
                  <NumberField
                    field={{
                      key: "seed",
                      label: "Random seed",
                      value: 2026,
                      min: 0,
                      max: 2147483646,
                      step: 1,
                    }}
                    value={seed}
                    onChange={(v) => {
                      setSeed(v);
                      setGenerated(false);
                      setResult(null);
                    }}
                  />
                  <small>
                    The same seed and generating model give the same
                    2,500-observation sequence.
                  </small>
                </details>
                <button
                  className="primary"
                  disabled={!mode || busy}
                  onClick={() => {
                    if (generated) setSeed((s) => (s + 1) % 2147483647);
                    setGenerated(true);
                  }}
                >
                  {" "}
                  {generated ? "New sample" : "Generate sample"} <span>→</span>
                </button>
                {result && (
                  <a className="sample-link" href="#observed-data">
                    View observed data ↓
                  </a>
                )}
              </section>
              <section className={!generated || !mode ? "locked" : ""}>
                <p className="step-label">03 / THE PRIOR</p>
                <label className="field">
                  <span>Compatible prior</span>
                  <select
                    aria-label="Compatible prior"
                    value={family}
                    disabled={!generated || !mode || mode === "known"}
                    onChange={(e) => setFamily(e.target.value)}
                  >
                    <option value="">Choose a prior</option>
                    <option value="conjugate">{familyLabel}</option>
                    {(reference || family === "reference") && (
                      <option value="reference">
                        {["bernoulli", "binomial"].includes(model)
                          ? "Jeffreys Beta(½, ½)"
                          : "Reference prior (advanced)"}
                      </option>
                    )}
                  </select>
                </label>
                {mode === "known" ? (
                  <p className="help">
                    All parameters are known. There is no unknown parameter to
                    update.
                  </p>
                ) : !generated ? (
                  <p className="help">Generate a sample to explore a prior.</p>
                ) : (
                  <>
                    <details
                      open={reference}
                      onToggle={(e) => setReference(e.currentTarget.open)}
                    >
                      <summary>Reference priors</summary>
                      <p className="help">
                        Some reference priors are improper. They have no
                        normalized density; a valid posterior must still
                        integrate to one.
                      </p>
                      <button
                        className="text-button"
                        onClick={() => setFamily("reference")}
                      >
                        Use model reference prior
                      </button>
                    </details>
                  </>
                )}
                {family === "conjugate" && mode !== "known" && (
                  <div className="prior-inputs">
                    {familyLabel === "Normal" ? (
                      <>
                        <NumberField
                          field={{ key: "m", label: "Prior mean", value: 0 }}
                          value={h.m}
                          onChange={(v) => priorEdit("m", v)}
                        />
                        <NumberField
                          field={{
                            key: "v",
                            label: "Prior variance",
                            value: 10,
                            min: 0.000001,
                          }}
                          value={h.v}
                          onChange={(v) => priorEdit("v", v)}
                        />
                      </>
                    ) : (
                      <>
                        {familyLabel === "Beta" ? (
                          <>
                            <NumberField
                              field={{
                                key: "pm",
                                label: "Prior mean probability",
                                value: 0.5,
                                min: 0.000001,
                                max: 0.999999,
                                step: 0.01,
                              }}
                              value={h.a / (h.a + h.b)}
                              onChange={(v) => {
                                const c = h.a + h.b;
                                setH({ ...h, a: v * c, b: (1 - v) * c });
                              }}
                            />
                            <NumberField
                              field={{
                                key: "c",
                                label: "Concentration a + b",
                                value: 4,
                                min: 0.000001,
                                help: "Higher concentration puts more prior mass near its mean.",
                              }}
                              value={h.a + h.b}
                              onChange={(v) => {
                                const m = h.a / (h.a + h.b);
                                setH({ ...h, a: m * v, b: (1 - m) * v });
                              }}
                            />
                          </>
                        ) : familyLabel === "Gamma" ? (
                          <>
                            <NumberField
                              field={{
                                key: "gm",
                                label: "Prior mean rate",
                                value: 1,
                                min: 0.000001,
                              }}
                              value={h.a / h.b}
                              onChange={(v) => priorEdit("b", h.a / v)}
                            />
                            <NumberField
                              field={{
                                key: "a",
                                label: "Prior shape a",
                                value: 2,
                                min: 0.000001,
                              }}
                              value={h.a}
                              onChange={(v) => {
                                const m = h.a / h.b;
                                setH({ ...h, a: v, b: v / m });
                              }}
                            />
                          </>
                        ) : (
                          <>
                            {familyLabel === "Normal–Inverse-Gamma" && (
                              <>
                                <NumberField
                                  field={{
                                    key: "m",
                                    label: "Prior location m₀",
                                    value: 0,
                                  }}
                                  value={h.m}
                                  onChange={(v) => priorEdit("m", v)}
                                />
                                <NumberField
                                  field={{
                                    key: "k",
                                    label: "Mean strength κ₀",
                                    value: 1,
                                    min: 0.000001,
                                    help: "Conditional mean variance is sigma² / κ₀.",
                                  }}
                                  value={h.k}
                                  onChange={(v) => priorEdit("k", v)}
                                />
                              </>
                            )}
                            <NumberField
                              field={{
                                key: "a",
                                label: "Inverse-Gamma shape a",
                                value: 2,
                                min: 0.000001,
                              }}
                              value={h.a}
                              onChange={(v) => priorEdit("a", v)}
                            />
                            <NumberField
                              field={{
                                key: "b",
                                label: "Inverse-Gamma scale b",
                                value: 2,
                                min: 0.000001,
                              }}
                              value={h.b}
                              onChange={(v) => priorEdit("b", v)}
                            />
                          </>
                        )}
                        <details>
                          <summary>Native hyperparameters</summary>
                          <NumberField
                            field={{
                              key: "a",
                              label: "a (shape)",
                              value: 2,
                              min: 0.000001,
                            }}
                            value={h.a}
                            onChange={(v) => priorEdit("a", v)}
                          />
                          <NumberField
                            field={{
                              key: "b",
                              label:
                                familyLabel === "Beta"
                                  ? "b (shape)"
                                  : familyLabel === "Gamma"
                                    ? "b (rate)"
                                    : "b (scale)",
                              value: 2,
                              min: 0.000001,
                            }}
                            value={h.b}
                            onChange={(v) => priorEdit("b", v)}
                          />
                        </details>
                      </>
                    )}
                    <p className="help">
                      These beliefs are yours to specify. They are not fitted
                      from this sample.
                    </p>
                  </div>
                )}
                {family && mode !== "known" && (
                  <>
                    <label className="field">
                      <span>
                        Credible level{" "}
                        <strong>{Math.round(level * 100)}%</strong>
                      </span>
                      <input
                        aria-label="Credible level"
                        type="range"
                        min="50"
                        max="99"
                        value={Math.round(level * 100)}
                        onChange={(e) => setLevel(+e.target.value / 100)}
                      />
                    </label>
                    {model === "rayleigh" && (
                      <label className="field">
                        <span>Display parameter</span>
                        <select
                          value={scale}
                          aria-label="Display parameter"
                          onChange={(e) => setScale(e.target.value)}
                        >
                          <option value="variance">Squared scale sigma²</option>
                          <option value="sigma">Scale sigma</option>
                        </select>
                      </label>
                    )}
                  </>
                )}
              </section>
            </aside>
            <div className="results" aria-live="polite" aria-busy={busy}>
              {busy && (
                <div className="status">
                  <span className="spinner" />
                  Calculating in R… The first run loads the local R engine.
                </div>
              )}
              {error && (
                <div className="error" role="alert">
                  <strong>Check this experiment</strong>
                  <p>{error}</p>
                  <button
                    className="text-button"
                    onClick={() => {
                      restartEngine();
                      setGenerated(false);
                      setResult(null);
                      setError("");
                    }}
                  >
                    Restart engine
                  </button>
                </div>
              )}
              {!result && !busy && !error && (
                <div className="result-placeholder">
                  <span className="outline-symbol">∿</span>
                  <h2>First, let’s observe some data.</h2>
                  <p>
                    Set the generating parameters, declare what is known, and
                    generate a sample.
                  </p>
                  <p className="small-note">
                    Your data will stay fixed while you explore different
                    priors.
                  </p>
                </div>
              )}
              {result && presentation && (
                <div className={busy ? "pending" : ""}>
                  <section className="data-section" id="observed-data">
                    <div className="section-heading">
                      <div>
                        <p className="step-label">YOUR SIMULATED SAMPLE</p>
                        <h2>Observed data</h2>
                      </div>
                      <span className="model-label">
                        {catalog[model].label} · seed {result.request.seed}
                      </span>
                    </div>
                    <div className="metric-strip">
                      <div>
                        <span>Observations</span>
                        <strong>{result.sample.n}</strong>
                      </div>
                      <div>
                        <span>Sample mean</span>
                        <strong>{fmt(result.sample.mean)}</strong>
                      </div>
                      <div>
                        <span>Sample variance</span>
                        <strong>{fmt(result.sample.variance)}</strong>
                      </div>
                    </div>
                    <Chart figure={observedFigure} />
                    <p className="small-note">
                      {result.observed.note} Sample variance uses n − 1.
                    </p>
                  </section>
                  {ready && result.status === "improper" && (
                    <div className="error" role="alert">
                      {result.note}
                    </div>
                  )}
                  {ready && result.panels.length > 0 && (
                    <section className="posterior-section">
                      <div className="section-heading">
                        <div>
                          <p className="step-label">BELIEFS, UPDATED</p>
                          <h2>Prior and posterior</h2>
                        </div>
                        <span className="model-label">
                          {Math.round(result.request.level * 100)}% credible
                          level
                        </span>
                      </div>
                      <p className="section-intro">
                        The posterior combines your prior specification with
                        these same {result.sample.n} observations. Proper prior
                        densities are shown as dashed lines.
                      </p>
                      {result.note && <p className="notice">{result.note}</p>}
                      <div
                        className={
                          result.panels.length > 1 ? "panels joint" : "panels"
                        }
                      >
                        {result.panels.map((p, i) => (
                          <PosteriorPanel
                            key={model + mode + i}
                            panel={p}
                            defs={presentation[0]}
                            bindings={presentation[1]}
                          />
                        ))}
                      </div>
                      <details className="update-details">
                        <summary>See the conjugate update</summary>
                        <p className="formula">{result.formula}</p>
                        <p>
                          n = {result.sample.n}; sum(x) ={" "}
                          {fmt(result.sample.sum)}; sum(x²) ={" "}
                          {fmt(result.sample.sum_squares)}. Intervals use
                          posterior quantiles, not a Normal approximation.
                        </p>
                      </details>
                    </section>
                  )}
                  {ready && result.status === "sample" && mode !== "known" && (
                    <div className="next-step">
                      <h3>What do you believe before seeing these data?</h3>
                      <p>
                        Choose a compatible prior on the left to see how your
                        beliefs update.
                      </p>
                    </div>
                  )}
                  {ready && mode === "known" && (
                    <div className="next-step">
                      <h3>No unknown parameters</h3>
                      <p>
                        The generating model is fully known. Declare a parameter
                        unknown to explore Bayesian inference.
                      </p>
                    </div>
                  )}
                  <div className="export-row">
                    <span>Keep this experiment</span>
                    <button
                      disabled={!ready}
                      onClick={() =>
                        download(
                          "bayesian-sample.csv",
                          "observation,value\n" +
                            result.sample.values
                              .map((v, i) => `${i + 1},${v}`)
                              .join("\n"),
                          "text/csv",
                        )
                      }
                    >
                      Download data CSV ↓
                    </button>
                    <button
                      disabled={!ready}
                      onClick={() =>
                        download(
                          "bayesian-experiment.json",
                          JSON.stringify(
                            { manifest: presentation[2], ...result },
                            null,
                            2,
                          ),
                          "application/json",
                        )
                      }
                    >
                      Download results JSON ↓
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        <footer>
          <span>Bayesian Prior Lab</span>
          <span>
            Statistics in R · Graphics authored in Python · Runs in your browser
          </span>
        </footer>
      </main>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
