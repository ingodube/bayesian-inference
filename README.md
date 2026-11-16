# Bayesian Prior Lab

An introductory, browser-based laboratory for exploring how prior beliefs and sample size shape Bayesian posteriors.

[Open the dashboard](https://ingodube.github.io/bayesian-inference/)

The interface starts empty. Choose a likelihood, specify generating parameters, declare which parameters are known, and generate a sample. Choose a compatible prior to see the analytic posterior, its mean, median and mode, and an adjustable equal-tailed credible interval (95% by default).

## Models

Bernoulli, Binomial and Geometric with Beta priors; Poisson, Exponential and known-shape Gamma with Gamma priors; Rayleigh squared scale with an Inverse-Gamma prior; and three Normal models: unknown mean, unknown variance, or both unknown with a joint Normal–Inverse-Gamma prior. An advanced reference-prior mode checks posterior propriety explicitly.

- Sample sizes: 20, 100, 500, 1,000 and 2,500, using prefixes of the same seeded sequence.
- Observed-data histogram with generating distribution, sample mean and unbiased sample variance.
- One active prior; changing its hyperparameters never changes the observations.
- Marginal posterior plots, point estimates, interval shading, boundary-mode and undefined-moment handling.
- Rayleigh output on either squared scale or scale, with the correct transformed density and summaries.
- Download observations as CSV and the complete experiment and build metadata as JSON.
- English interface, responsive layout, no account, telemetry or computational server.

## Architecture

`research-pipeline/engine.R` is the **only statistical implementation**. It runs natively for validation and through webR 0.6.1 in a browser worker. Only R `base` and `stats` are required at runtime.

`dashboard/build.py` defines the charts with Python/Plotly and exports their JSON definitions, dynamic bindings and integrity manifest. The React/TypeScript application binds fresh R results into these definitions and renders them with Plotly.js. Python is a build dependency; visitors install nothing.

GitHub Pages serves the complete static build, including the self-hosted R WebAssembly runtime and its lazy filesystem. Runtime requests remain on the site's origin. Opening `index.html` via `file://` is not supported: serve the application over HTTP/HTTPS.

## Run locally

From the repository root, with R, Python 3.13 and Node 24 available:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r dashboard\requirements.lock.txt
npm ci --prefix web
.\.venv\Scripts\python dashboard\build.py
npm --prefix web run prepare:runtime
npm --prefix web run dev
```

Open `http://127.0.0.1:4173/bayesian-inference/`.

On Linux/macOS use `.venv/bin/python` in place of `.venv\Scripts\python`.

## Validate and publish

```powershell
Rscript --vanilla research-pipeline/tests.R
Rscript --vanilla research-pipeline/export-fixtures.R
.\.venv\Scripts\python dashboard/build.py
.\.venv\Scripts\python -m pytest dashboard/tests -q
npm --prefix web test
cd web
node scripts/verify-parity.mjs
npm run build
```

The workflow validates formulas, quantiles, propriety and cross-runtime parity before publishing `web/dist` to GitHub Pages on pushes to `main`. Enable Pages with **GitHub Actions** as the source. Dependency versions are fixed in the Python lock file and npm lock file. Build outputs, local environments and the downloaded runtime are not committed.

See [statistical conventions and data contracts](docs/methodology.md) and [release validation](docs/validation.md). Native Android/iOS device verification is recorded separately from browser viewport checks; a responsive screenshot is not a real-device performance test.

## Extending this repository

Future methods should have an explicit statistical contract and independent reference cases before being exposed in the interface. Natural next additions are known-dispersion Negative Binomial/Beta, Lognormal via the Normal kernel, HPD regions and nonconjugate methods. Current scope does not include uploaded datasets, Gamma unknown-shape inference, repeated-simulation coverage studies or MCMC.
