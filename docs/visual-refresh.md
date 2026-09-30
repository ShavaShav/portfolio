# Shaververse observatory refresh

The terminal commands, destinations, flight controls, encounters, missions,
companion context, streaming chat, audio, and external links are retained. This
refresh changes presentation, framing, and rendering budgets, not the API.

## Interface

- A terminal-only entry screen retaining the original typed boot sequence and
  commands. Desktop visitors launch by command; the existing launch button
  remains available on mobile. There is no splash headline or illustration.
- An observatory-style cockpit: slate panels, mint accents, warm annotations,
  clearer typography, destination markers, and more readable content/chat.
- Non-overlapping default panels, a minimized-window dock, active-window
  stacking, and viewport clamping after resize. Custom saved layouts are kept.
  Use **Reset Layout** to adopt the new default arrangement on an existing visit.
- Updated mobile sheets, safe-area padding, larger touch controls, labeled
  controls, keyboard-accessible map destinations, dialog focus containment,
  Escape-to-close, and reduced-motion support for CSS and camera/sheet tweens.
- Mobile arrival automatically opens the selected world's details, with an
  adjacent **Chat with Zach** button. Map selection closes the map during
  approach; status and hints distinguish exploring, approaching, and returning.
  **Back to system** is available both inside the panel and in the scene header.
  Missions also provide a **Back to planet** action.
- Mobile chat remains mounted while hidden, preserving messages, drafts,
  streaming responses, and greetings. Switching between mission and chat keeps
  mission progress. Short landscape views use a full-height sheet with the
  decorative portrait hidden to keep chat and return controls reachable.

## Scene and physics

- Seam-free spherical coordinates and view-dependent limb darkening on the sun,
  plus a Fresnel corona instead of a flat translucent globe.
- Correct color-space output from custom shaders, restrained HDR bloom, tone
  mapping, and FXAA. The permanent chromatic aberration has been removed.
- Fixed back-face atmospheric falloff, local-coordinate cloud sampling, stable
  rocky/terran terrain, shader bump detail, and less saturated mineral palettes.
- Procedural banded rings with a division, softened edges, a planet-cast shadow,
  and anti-aliased fine stripes. No downloaded texture assets are required.
- Oblique sunlit approaches with room for rings. Portrait overview framing
  includes more destinations, and unrelated labels are hidden during close-ups.
- Moon texture generation uses a single pixel-buffer upload rather than
  thousands of drawing calls, with corrected sRGB colors and bump detail.
- Ambient dust moves on the GPU around fixed positions: no per-frame buffer
  upload, frame-rate-dependent drift, or unbounded accumulation.
- Frame-rate-independent idle camera rotation and exponential asteroid impulse
  damping. Flight keys/thrust are released when the window loses focus.

## Performance

The WebGL scene is lazy-loaded when launching; it is not part of the terminal's
initial JavaScript bundle. The production entry bundle went from **1,426.23 kB
to about 407.5 kB** (uncompressed), and **409.44 kB to about 132.9 kB** gzipped:
approximately **71% less initial JavaScript / 68% less compressed transfer**.
The complete scene is still substantial and Vite may report a large lazy chunk.
This is a loading improvement, not a measured claim about device FPS.

All scene budgets live in `src/data/renderQuality.ts`:

| Budget | High | Medium | Low |
| --- | ---: | ---: | ---: |
| Maximum pixel ratio | 1.75 | 1.25 | 1 |
| Stars | 3,200 | 1,600 | 650 |
| Ambient particles | 140 | 60 | 0 |
| Instanced belt bodies | 4,800 | 1,800 | 600 |
| Planet sphere segments | 64 | 40 | 24 |
| Postprocessing | Yes | Yes | None |

The old desktop belt rendered 10,400 bodies, with higher-poly geometry in one
layer, regardless of a quality downgrade. Both layers now use low-poly instanced
geometry and scale with the selected tier. Bounds are calculated for culling.

Quality is sampled from actual Three Fiber scene frames, after a two-second
warmup. Two consecutive three-second slow windows cause a downgrade: below
42 FPS moves high to medium; below 26 FPS moves to low. There is no automatic
upgrade cycle that would repeatedly rebuild materials. Background-tab intervals
are excluded and the WebGL frame loop is paused while the page is hidden.

Low quality skips the composer, clouds, and atmosphere shells entirely; a cheap
lit surface and shader corona keep the scene usable without those passes.

The implementation follows [Three.js color-management guidance](https://threejs.org/manual/pages/color-management.html)
and [React Three Fiber's rendering-budget guidance](https://r3f.docs.pmnd.rs/next/advanced/scaling-performance).

## Verification and deployment

Use Node 22.12+ (or a Node 20 version supported by the installed Vite release).

```sh
npm ci
npm run dev
npm run lint
npm run format:check
npm test
npm run build
```

The 38 regression tests cover terminal commands and mobile-only launch controls,
quality downgrade behavior, StrictMode, device ceilings, render budgets,
material cleanup, portrait framing,
stored/resized panel layouts, mobile arrival/return flows, persistent panel
content, and dialog focus behavior. Vitest discovery is
limited to `src/` so unrelated nested workspace checkouts are not run as tests.

Browser checks exercise desktop/mobile navigation, a complete mission,
streaming chat with a mocked API response, portrait/landscape layouts, panel
dragging/resizing/minimizing/restoring/resetting, viewport clamping, and
high/medium/low WebGL rendering. Mobile checks also cover direct 3D taps,
automatic arrival panels, greetings, chat persistence, contextual mission chat,
and returns from both the sheet and header. The production-bundle check verifies that
the scene is loaded only after launch. Real API responses and physical-device
GPU performance still need to be checked after deployment; the browser checks
use software WebGL.

Only the frontend needs a GitHub Pages deployment for this refresh. No Vercel
environment-variable changes are introduced. The existing backend-model fix
is independent of these UI changes.

Styles are controlled by shared tokens in `src/index.css` and the skin in
`src/components/cockpit/observatory.css`; entry-screen styles live in
`src/components/Terminal.css`. No new application dependencies were added.
