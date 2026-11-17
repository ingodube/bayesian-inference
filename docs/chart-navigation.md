# Chart navigation

All observed-data and posterior plots use the shared `Chart` component. One touch pans both axes; a two-touch pinch applies the same zoom factor to both axes and anchors the data coordinate under the moving midpoint. Navigation changes the rendered axis ranges only. It never imports the R engine, changes the scenario, or adds navigation fields to exports.

## Interaction contract

- Only Plotly's Cartesian `.nsewdrag` surface has `touch-action: none`. Chart containers, legends, labels, controls and the rest of the page retain browser touch handling and page zoom. The HTML viewport does not restrict user scaling.
- Pointer capture keeps a gesture continuous when a finger crosses the surface boundary. Capture-phase handlers intercept touch pointers and the corresponding legacy Touch Events before Plotly can process the same gesture. Mouse input continues through Plotly's Python-authored `dragmode=pan` setting.
- A movement smaller than 6 CSS pixels is a tap; the adapter uses Plotly hover to show its value. After a pinch, lifting either finger rebases the remaining contact without a jump. Additional contacts are ignored until the next gesture.
- Single-touch momentum uses samples from the last 80 ms, exponential decay with a 250 ms time constant, and a cutoff at 10 px/s or one second. A new contact cancels momentum. Pinching never creates momentum, and `prefers-reduced-motion` disables it.
- The initial axis spans define zoom limits of 0.1x through 100x. Every update must have finite, increasing, numerically distinguishable endpoints. Panning is free; `Reset view` recovers content moved off screen.
- Buttons zoom by a factor of 1.25 around the center. Arrow keys move the view by 10% of its dimensions; +/− zoom and Home resets while the chart has focus. All navigation buttons have minimum 44x44 CSS-pixel targets.

## State and scheduling

The component's `viewKey` describes the displayed content, not incidental React renders. Observed-data keys use model, generator parameters, n and seed; posterior keys include the inference request, marginal identity and focused/expanded selection. Changing an observed-data prior or credible level preserves its view. A new content key captures a fresh initial view. `Include prior range` establishes the new initial limits for that panel.

Each mounted chart owns its controller, baseline, pending viewport and render queue. There is at most one relayout in flight, one replaceable pending viewport, and one launch per animation frame. Replacing content detaches the old controller, discards its pending work and waits for its active relayout before rendering. Resizing cancels gestures/momentum while preserving axis ranges. Unmounting releases captures/listeners, cancels frames and waits before purging Plotly.

ResizeObserver supplies the available width to the same serialized render path, preserving the current viewport and the Python-defined figure height. Plotly's separate responsive resize listener is disabled to avoid racing resizes against relayouts and drifting legend placement. A resize can re-render the figure; pointer movements only update ranges.

Python anchors posterior legends to the top of the entire figure container (`yref=container`), allowing their wrapped height to push the drawing area down. Anchoring above the plotting paper alone caused legends to overlap curves after orientation changes in Plotly 3.1.0. Artifact tests protect the container anchor, while the component gives the chart its explicit Python-authored height.

## Plotly compatibility boundary

`plotly-surface.ts` is the sole reader of the rendered `_fullLayout` axes and `.nsewdrag` geometry for Plotly 3.1.0. It validates linear axes, nonempty geometry and finite ranges. Do not scatter private Plotly reads into components or gesture math. Updating Plotly requires reviewing this adapter and repeating the real-browser checks. Unit tests pin the installed version and exercise missing/incompatible surfaces.

`touch-navigation.ts` contains viewport geometry, pointer-state transitions, momentum and the replaceable-frame writer. These are presentation calculations, separate from statistical calculations in R. Tests use an injected clock to verify velocity, cancellation, reduced motion, anchoring, limits and delayed renders without wall-clock sleeps.

## Device acceptance

On physical Android Chrome and iOS Safari, test a one-finger drag, two-finger pan, pinch in/out, contact transitions, rapid re-touch during momentum, orientation changes and Reset view. Confirm that the page does not move during gestures inside the plot and that scrolling/browser zoom remain available outside it. Verify tap values and legend taps separately.

Use Bernoulli with 20 failures/Jeffreys prior, Poisson at n=2,500, both Normal marginals with a strongly conflicting prior and Rayleigh on sigma² and sigma. Check unchanged observations, intervals and downloaded JSON before/after navigation. Record device/OS/browser, performance and failures in `validation.md`. Desktop viewport checks and controller simulations do not establish physical multitouch support.

A reusable repository-local skill for this controller-test → browser-state/export check → physical-device checklist → Pages verification workflow is recommended for future interactive charts.
