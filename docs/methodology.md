# Statistical and data contracts

## Ownership of calculations

All sampling, sufficient statistics, histograms, densities, posterior updates, moments, quantiles and propriety checks live in R. Python owns Plotly chart designs. TypeScript owns controls, request scheduling, figure bindings and downloads; it must not implement alternative Bayesian formulas.

The browser uses typed R objects through webR, never interpolation of input values into R source. The kernel has no non-base R runtime dependencies. The tiny JSON writer serializes only engine-created lists and primitive values; it is not a general JSON parser.

## Parametrizations

Plotting must not reject a valid posterior merely because a proper prior has unrepresentable tail quantiles. Prior intervals expose `status: numerical_limit` with null endpoints where needed; posterior intervals must remain finite. Curves are evaluated across both displayed distributions, and the expanded domain includes the generating truth even for improper reference priors. See the [stress audit](audit-2026-11-16.md) for regressions protecting these rules.

- Normal(m, v) uses variance; R functions receive `sd=sqrt(v)`.
- Gamma(a, b) is shape/rate with mean a/b.
- Inverse-Gamma(a, b) is proportional to v^(-a-1) exp(-b/v), with mean b/(a-1) only for a>1 and finite variance only for a>2.
- Geometric observations count failures before one success, with support 0,1,2,…
- Binomial m is known trials per observation; n counts independent observations, not trials.
- Gamma shape k must be known; the inferred parameter is its rate.
- Rayleigh location is zero, density x/sigma² exp(-x²/(2sigma²)). The conjugate update is on v=sigma². The density on sigma includes Jacobian 2sigma. E[sigma]=sqrt(b) Gamma(a-1/2)/Gamma(a) for a>1/2; mode=sqrt(2b/(2a+1)).

## Normal models

Known variance: posterior precision 1/V0+n/v; posterior mean is (m0/V0+sum(x)/v) divided by posterior precision.

Known mean: Inverse-Gamma(a+n/2, b+sum((x-mu)²)/2).

Both unknown: v~IG(a,b), mu|v~N(m0,v/k). Update k'=k+n, m'=(k*m0+n*xbar)/k', a'=a+n/2, b'=b+SSE/2+k*n*(xbar-m0)²/(2k'). The marginal mean distribution is Student-t with df=2a', location=m' and scale sqrt(b'/(a'k')). Plots show marginals, not a joint credible region. The joint prior is not a pair of independent priors.

## Reference priors

Bernoulli/Binomial use proper Beta(1/2,1/2). Geometric uses the improper kernel p^(-1)(1-p)^(-1/2), giving Beta(n,S+1/2). Poisson uses lambda^(-1/2), giving Gamma(S+1/2,n). Exponential and known-shape Gamma use 1/lambda. Rayleigh squared scale and known-mean Normal variance use 1/v. Known-variance Normal mean uses a flat prior. Joint Normal uses p(mu,v) proportional to 1/v, giving IG((n-1)/2,SSE/2) and marginal t_(n-1)(xbar,s/sqrt(n)). This joint reference is not joint Jeffreys.

Improper priors are implemented as explicit limits, not tiny positive hyperparameters, and have no plotted normalized prior density. Posterior parameters must define a proper distribution before quantiles or estimates are returned. Constant observations make the joint Normal reference posterior improper when SSE=0. Means, variances and modes have explicit existence or boundary states.

## Simulation and state

R uses Mersenne-Twister/Inversion/Rejection and a recorded integer seed to generate exactly 2,500 iid observations. Each n uses a prefix. Generating parameters and the seed determine sample identity; prior and credible level determine inference identity. Known parameters equal the generating values only after an explicit declaration by the user. Prior hyperparameters are never silently estimated from the sample or set to its true generating parameter.

All primary priors are proper. Broadness is not labeled universally noninformative. A single realized sample cannot demonstrate frequentist bias, error or coverage. Sample variance divides by n-1. Credible intervals use exact-family quantiles with equal tail probability and default probability .95 (allowed .50–.99). HPD is outside v1.

## Version 1 interfaces

`ModelSpec` describes fields, support conventions and allowed prior families. `ScenarioRequest` contains model, gen, mode, n, seed, level, prior and display scale. `SampleState` is implicit in the request and deterministically regenerated; results include active observations, sufficient statistics, RNG and R version. This avoids long-lived sample caches while preserving identical data.

`ScenarioResult` contains request, sample, observed histogram, marginal panels, formula, notes and status: sample, posterior, improper or error. Each summary includes a numeric value or null plus status/reason. Mode has a list of values and state (finite, boundary, boundary_multiple, all_values). Single numeric vectors may serialize as scalars; presentation bindings normalize these to arrays. No nonfinite numbers are serialized as zero.

`BuildManifest` records schema version, commit, Python/Plotly/R/webR versions, file sizes and SHA-256 hashes of charts, bindings and kernel. The self-hosted runtime has a separate integrity manifest. JSON downloads include both build provenance and scenario results.

## References

- [Murphy: Conjugate Bayesian analysis of the Gaussian distribution](https://www.cs.ubc.ca/~murphyk/Papers/bayesGauss.pdf)
- [R distribution reference](https://stat.ethz.ch/R-manual/R-devel/library/stats/html/Distributions.html)
- [NIST Rayleigh parametrization](https://itl.nist.gov/div898/software/dataplot/refman2/auxillar/raypdf.htm)
- [webR self-hosting and PostMessage](https://docs.r-wasm.org/webr/latest/serving.html)

## Reusable workflow

Preserve this R → Python/Plotly → webR → GitHub Pages boundary for later methods. After the workflow stabilizes, a repository-local skill is recommended to encode the statistical extension checklist, artifact generation, parity checks and release procedure.
