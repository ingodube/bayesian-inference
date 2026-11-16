# Repository instructions

- R is the single statistical source of truth. Do not reimplement posterior calculations in Python or TypeScript.
- Define charts in Python/Plotly and export them with explicit bindings; JavaScript only binds result values and presentation state.
- Read `docs/methodology.md` before changing formulas, priors, parametrizations or result schemas.
- Run native R checks, cross-runtime parity, Python artifact checks, Node binding tests and the production build for statistical changes.
- Keep initial application state empty and the interface entirely English.
- Preserve seeded sample prefixes across n and keep observations fixed across prior/credible-level changes.
- Do not claim real-device validation from viewport emulation; record verification limits in `docs/validation.md`.
- If a task reveals a reusable workflow, suggest a repository-local skill. Document durable statistical or architectural knowledge locally.
