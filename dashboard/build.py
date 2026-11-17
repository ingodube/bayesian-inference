"""Build the sole Plotly visual definitions and a deterministic release manifest."""
import hashlib
import json
import platform
import shutil
import subprocess
from pathlib import Path

import plotly
import plotly.graph_objects as go

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "web/public"


def figure(kind):
    f = go.Figure()
    f.update_layout(
        template="none", paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
        font=dict(family="Segoe UI, Arial, sans-serif", size=12, color="#26383d"),
        margin=dict(l=60, r=24, t=26, b=62), height=350,
        hovermode="closest", dragmode="pan", legend=dict(orientation="h", y=-0.22, x=0),
        xaxis=dict(title="Observed value" if kind == "observed" else "Parameter value", showgrid=False, zeroline=False),
        yaxis=dict(title="Density", gridcolor="#e1e6e3", zeroline=False, rangemode="tozero"),
        hoverlabel=dict(bgcolor="#ffffff", font_color="#26383d"),
    )
    if kind == "observed":
        f.add_bar(name="Observed data", x=[], y=[], marker_color="#96b4b1", opacity=0.8,
                  hovertemplate="Value: %{x:.4g}<br>Height: %{y:.4g}<extra>Observed data</extra>")
        f.add_scatter(name="Generating distribution", x=[], y=[], mode="lines+markers",
                      line=dict(color="#273f4b", width=2), marker=dict(size=4),
                      hovertemplate="Value: %{x:.4g}<br>Height: %{y:.4g}<extra>Generating distribution</extra>")
    else:
        # A wrapped mobile legend must not share space with the x-axis title.
        f.update_layout(height=420, legend=dict(y=1, yref="container", yanchor="top"))
        f.add_scatter(name="Credible interval", x=[], y=[], mode="lines", fill="tozeroy",
                      line=dict(width=0), fillcolor="rgba(21,121,119,0.16)", hoverinfo="skip")
        f.add_scatter(name="Prior", x=[], y=[], mode="lines", line=dict(color="#bb8855", width=2, dash="dash"))
        f.add_scatter(name="Posterior", x=[], y=[], mode="lines", line=dict(color="#087f80", width=3))
    return f.to_plotly_json()


def build():
    PUBLIC.mkdir(parents=True, exist_ok=True)
    figures = {k: figure(k) for k in ["observed", "posterior"]}
    figures["markers"] = {}
    for key, color, dash in [("truth", "#798489", "dot"), ("mean", "#195876", "dash"),
                             ("median", "#705891", "dot"), ("mode", "#a05f46", "dashdot")]:
        figures["markers"][key] = go.Scatter(x=[], y=[], mode="lines", line=dict(color=color, width=1.5, dash=dash), hoverinfo="name").to_plotly_json()
    (PUBLIC / "figures.json").write_text(json.dumps(figures, separators=(",", ":")), encoding="utf-8")
    bindings = {
        "observed": {"data.0.x": "x", "data.0.y": "y", "data.0.width": "width", "data.1.x": "theory_x", "data.1.y": "theory_y"},
        "posterior": {"data.0.x": "shade.x", "data.0.y": "shade.y", "data.1.x": "prior_curve.x", "data.1.y": "prior_curve.y", "data.2.x": "curve.x", "data.2.y": "curve.y"},
    }
    (PUBLIC / "bindings.json").write_text(json.dumps(bindings, indent=2), encoding="utf-8")
    shutil.copyfile(ROOT / "research-pipeline/engine.R", PUBLIC / "engine.R")
    files = {p.name: {"sha256": hashlib.sha256(p.read_bytes()).hexdigest(), "bytes": p.stat().st_size}
             for p in [PUBLIC / "figures.json", PUBLIC / "bindings.json", PUBLIC / "engine.R"]}
    commit = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True).stdout.strip() or "uncommitted"
    r_version = subprocess.run(["Rscript", "--vanilla", "-e", "cat(as.character(getRversion()))"], capture_output=True, text=True, check=True).stdout
    manifest = dict(schema_version=1, commit=commit, python=platform.python_version(), plotly=plotly.__version__,
                    r=r_version, webr="0.6.1", files=files)
    (PUBLIC / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print("Built Python Plotly definitions, bindings, R kernel and manifest.")


if __name__ == "__main__":
    build()
