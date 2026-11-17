# Validation and release record

## Automated gates

- Native R tests cover hand-calculated updates, Normal joint marginals, distribution equivalences, density normalization, credible mass, boundary modes, undefined moments, reference posterior propriety, Rayleigh transformation and preservation of sample prefixes.
- Cross-runtime checks use 21 seeded scenarios at n=2,500 (every likelihood, each Normal mode, conjugate/reference priors and Rayleigh scale transformation), two numerical-limit regressions at n=100, and the 200-case stress matrix. Absolute tolerance is 1e-8 plus relative tolerance 1e-6. R version strings are intentionally excluded.
- Python verifies published kernel identity and SHA-256 hashes, Plotly trace designs and binding contracts.
- Node verifies chart binding without mutation of the Python definitions, missing prior curves, coincident estimator labels and range selection.
- TypeScript checks and the production build must pass before deployment.

On Windows only, the Node parity runner copies the webR worker into ignored artifacts and fixes its absolute-path dynamic import to a file URL. This isolated adapter is necessary for webR 0.6.1 on Windows/Node and does not alter the shipped browser runtime or statistical code. Linux CI uses the original runtime.

## Browser acceptance

Touch navigation is specified in [chart-navigation.md](chart-navigation.md). Controller simulations cover pan/pinch anchoring, zoom bounds, tap threshold, one/two/one contact transitions, extra contacts, momentum decay/interruption, reduced motion, cancellation, reset, independent panels and serialized/coalesced updates. These tests do not simulate a physical browser's touch arbitration.

Implementation verification (2026-11-17): 14 Node tests, two Python artifact checks and the TypeScript/production build passed. Desktop browser checks exercised Normal joint marginals with a prior location of -100, Bernoulli with 20 failures and Jeffreys prior, Poisson at n=2,500 and Rayleigh at n=2,500 on both sigma² and sigma. Zoom buttons, arrow-key pan, reset and focused/expanded changes worked independently per panel, without console errors. The observed-data zoom survived a prior change. JSON exported before/after navigation was byte-identical, and observations agreed across the prior change. At 390 px (375 px content), all navigation targets were at least 44x44 px, page width did not overflow, and computed touch-action was `none` only on the drawing surface; legends and containers remained `auto`. A 390→844 px orientation check preserved the Rayleigh zoom (horizontal span approximately 0.09885, 80% of its original span). These are desktop/browser-controller checks, not physical Android/iOS multitouch results.

Check empty opening; required knowledge declaration; sample generation; correct compatible prior; posterior rendering; fixed observations across prior/level changes; prefix stability across n changes; Normal modes; Rayleigh transformation; reference priors; downloads; reset and reload. Check keyboard operation and widths 1440, 768 and 390 px. Validate the production build on the actual project subpath and verify same-origin runtime resources.

Initial implementation verification (2026-11-16): 83 native statistical checks passed; 21 native R/webR cases passed with 175,751 numeric comparisons; two Python artifact checks and three JavaScript presentation/scheduling checks passed. In-browser runs at n=2,500 succeeded for all eight likelihoods and all three Normal modes. The joint Normal displayed two marginal panels; changing its prior location and credible level preserved the sample summaries. Reference-prior rendering, all-known mode, empty reset and downloads were verified. Exported JSON and CSV contained identical 2,500-observation samples and agreed with independently recomputed sample mean/variance. Responsive checks at 1440 px and 390 px (375 px content area after the scrollbar) found no horizontal page overflow. These are desktop-browser checks, not physical-device results.

## Real-device release gate

The follow-up [functional stress audit](audit-2026-11-16.md) records 200 additional scenarios, deliberate prior conflicts, graphical regressions, numerical-limit handling and native/webR parity. The stress suite is now a deployment gate.

Physical Android Chrome and iOS Safari performance/memory checks are **pending until executed on those devices**. A desktop browser narrowed to 390 px validates responsive layout only. Do not describe emulation or desktop webR timings as real-device validation.

Physical Android/iOS multitouch acceptance for the new navigation is also pending. In the desktop orientation regression, a wrapped posterior legend was found overlapping the curve after returning to a wide viewport. Explicit chart height, serialized resizing and Python's container-anchored legend corrected it; the final 390→1,440 px check showed the legend ending at the plot's upper edge, without overlap. Native mouse dragging continued to pan the axes.

Record device, OS/browser version, cold-load time, n=2,500 update time, memory if observable, touch scrolling, layout, and pass/fail for all likelihoods. The initial webR download is substantially larger than a typical static page; lazy filesystem files remain on the same origin. A calculation timeout offers a worker restart and never silently switches to another inference implementation.
