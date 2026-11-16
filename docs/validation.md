# Validation and release record

## Automated gates

- Native R tests cover hand-calculated updates, Normal joint marginals, distribution equivalences, density normalization, credible mass, boundary modes, undefined moments, reference posterior propriety, Rayleigh transformation and preservation of sample prefixes.
- Cross-runtime checks use 21 seeded scenarios at n=2,500: every likelihood, each Normal mode, conjugate/reference priors and Rayleigh scale transformation. Absolute tolerance is 1e-8 plus relative tolerance 1e-6. R version strings are intentionally excluded.
- Python verifies published kernel identity and SHA-256 hashes, Plotly trace designs and binding contracts.
- Node verifies chart binding without mutation of the Python definitions, missing prior curves, coincident estimator labels and range selection.
- TypeScript checks and the production build must pass before deployment.

On Windows only, the Node parity runner copies the webR worker into ignored artifacts and fixes its absolute-path dynamic import to a file URL. This isolated adapter is necessary for webR 0.6.1 on Windows/Node and does not alter the shipped browser runtime or statistical code. Linux CI uses the original runtime.

## Browser acceptance

Check empty opening; required knowledge declaration; sample generation; correct compatible prior; posterior rendering; fixed observations across prior/level changes; prefix stability across n changes; Normal modes; Rayleigh transformation; reference priors; downloads; reset and reload. Check keyboard operation and widths 1440, 768 and 390 px. Validate the production build on the actual project subpath and verify same-origin runtime resources.

Initial implementation verification (2026-11-16): 83 native statistical checks passed; 21 native R/webR cases passed with 175,751 numeric comparisons; two Python artifact checks and three JavaScript presentation/scheduling checks passed. In-browser runs at n=2,500 succeeded for all eight likelihoods and all three Normal modes. The joint Normal displayed two marginal panels; changing its prior location and credible level preserved the sample summaries. Reference-prior rendering, all-known mode, empty reset and downloads were verified. Exported JSON and CSV contained identical 2,500-observation samples and agreed with independently recomputed sample mean/variance. Responsive checks at 1440 px and 390 px (375 px content area after the scrollbar) found no horizontal page overflow. These are desktop-browser checks, not physical-device results.

## Real-device release gate

Physical Android Chrome and iOS Safari performance/memory checks are **pending until executed on those devices**. A desktop browser narrowed to 390 px validates responsive layout only. Do not describe emulation or desktop webR timings as real-device validation.

Record device, OS/browser version, cold-load time, n=2,500 update time, memory if observable, touch scrolling, layout, and pass/fail for all likelihoods. The initial webR download is substantially larger than a typical static page; lazy filesystem files remain on the same origin. A calculation timeout offers a worker restart and never silently switches to another inference implementation.
