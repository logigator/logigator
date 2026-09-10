# Changelog

All notable changes to the Logigator editor are recorded here. The most recent
release is listed first.

## 2.1.1 — 2026-08-31

### Fixes

- The editor now opens in the language and theme you use everywhere else on
  Logigator, and switching either one inside the editor changes it across the
  whole site.
- On a first visit, the editor picks its language from every language your
  browser asks for, instead of only the first one.

## 2.1.0 — 2026-08-06

### Features

- **Update all instances** of an outdated custom component in one step, from the
  settings panel. The palette marks components whose placed instances are behind.
- **View inside** the custom components embedded in a shared circuit, read-only.
  Nothing is added to your library.
- Paste no longer needs a selection on phones and tablets, and pasted elements land
  under the cursor instead of where they were copied from.
- The Ports panel now leads the side bar while a custom component is being edited.

### Fixes

- Clicking a switch or button while the simulation was still starting up crashed
  the simulation.
- Opening another project while a simulation was running crashed the simulation.
- Clicking inside a floating paste but between its components cancelled the paste
  instead of grabbing it.
- Tooltips and popovers near the edge of the screen pointed their arrow past what
  they were anchored to.

## 2.0.0 — 2026-08-04

Logigator has been **completely rebuilt** — an upgraded renderer, a far more
efficient rendering pipeline, a modern interface, and a wave of new
features. Everything you relied on is still here, now faster, sturdier, and
easier to use, with some big new capabilities on top.

### ✨ Highlights

- **⚡ A rebuilt foundation.** The rendering pipeline, simulation engine, and
  collision system were all rebuilt from the ground up: GPU-accelerated
  graphics keep large circuits smooth, a new simulation core drives the logic,
  and a more robust collision system makes editing far more stable and less
  bug-prone.
- **📱 Built for phones and tablets.** The editor is now fully responsive and
  touch-friendly, with multi-touch pan and zoom — build circuits anywhere, not
  just at a desk.
- **⛔ Negated inputs and outputs.** Invert a signal right at a component's port
  — no separate NOT gate to place and wire — for cleaner, more compact circuits.
- **💾 Save locally, right in your browser.** Keep projects and custom components
  on your own device — no account needed — and pick them up again any time. When
  you're ready, upload them to the cloud with one click and Logigator brings
  along every custom component they depend on.
- **♾️ An infinite canvas in every direction.** Build outward from the origin
  wherever you like — left, right, up, down. The previous editor only had
  positive coordinates, so the origin was a hard wall nothing could be placed
  past; now the canvas simply grows with your circuit.
- **🧩 Self-contained projects.** Every project now embeds a frozen copy of the
  custom components it uses, so it always opens, renders, and simulates — even
  offline or with the original component gone. Update placed components to the
  latest version whenever you choose, instead of every copy changing at once.
- **🗺️ Minimap.** A live overview of your whole circuit lets you find your way
  around large designs at a glance.

### Under the hood

- Rendering upgraded to **PixiJS 8**, wrapped in a far more efficient rendering
  pipeline — the scene is split into GPU render groups and culled through the
  quad tree — so panning, zooming, and editing stay smooth on large circuits.
- **Rebuilt simulation engine** — a new WebAssembly core, compiled from Rust,
  replaces the previous simulation engine
  ([`@logigator/sim`](https://www.npmjs.com/package/@logigator/sim)).
- **Rewritten collision system** — spatial checks now run on a quad tree with
  variable chunk size, making placement and drag collision more stable and far
  less bug-prone.
- **Unbounded coordinate space** — that same quad tree carries the infinite
  canvas: its root doubles toward whatever you place, expanding into negative
  space exactly as readily as positive, so the canvas has no origin corner and
  no fixed extent. The previous editor kept elements in a positive-indexed chunk
  array and rejected both chunks and placements at negative coordinates.

### Editor & canvas

- Refreshed, consistent interface across menus, dialogs, panels, and toasts, with
  a redesigned side-bar workbench.
- **Light and dark themes switch instantly** — no page reload, where the previous
  editor applied the change only after reloading.
- **Rotate whole selections** — components and wires together — in 90° steps,
  clockwise or counter-clockwise; a colliding placement stays floating until you
  drop it somewhere valid.
- **Move selections with the arrow keys**, one grid unit per press.
- **Clear collision feedback** — components and wires turn red while a placement,
  drag, or rotation would overlap something, so invalid positions are obvious at
  a glance.
- **The grid marks where things connect** — grid dots now sit exactly on the
  points that wires, port tips, and junctions terminate on, so wires run through
  the dots instead of between them.
- A **simpler, unified tool set**: wire routing and connection join/split merged
  into one wire tool (drag to route, tap to toggle a junction or a port's
  negation), the scissor "exact" select folded into the select tool, and panning
  promoted to a first-class tool.

### Files, components & sharing

- **Local browser storage** (IndexedDB) for projects and custom components, with
  one-click upload that promotes a document — and every custom component it
  depends on, children first — to the cloud.
- A **native, versioned file format** with a migration chain that upgrades older
  files on load (only the newest version is ever written), plus a compressed
  **`.lgix`** container with magic-byte framing.
- **Rebuilt custom-component embedding.** Every project and custom component now
  embeds a frozen copy of each custom component it uses — nested dependencies
  included — so a circuit always opens, renders, and simulates even when the
  original component is missing or you're offline. A missing component becomes
  editable-only and can be restored to your library in one step; the circuit is
  never broken.
- **Component updates on your terms.** When a newer version of a custom component
  is available, the editor flags it and lets you update placed instances to the
  latest — replacing the old model where editing a component changed every copy
  at once.
- **Manage projects and components in the editor** — rename and delete your saved
  projects and custom components straight from the open dialog and library,
  instead of heading to the account center on the website.
- **Fork attribution** — a fork's lineage is recorded in the exported file and
  re-resolved on upload, so original creators stay credited.

### Getting started & help

- A **hands-on tutorial** that has you place and wire real components; steps
  auto-advance by watching live project state, run on a scratch board so your work
  is untouched, and adapt to desktop and touch.
- **Just-in-time hints** that fire the first time you reach a relevant situation
  (wiring, simulating, pasting, and more), each linking into the documentation.
- **Restructured in-app documentation** — a sectioned, deep-linkable reference
  with cross-links, shown as a dialog on desktop and full-screen on compact.
- **In-editor bug reporting** that captures environment details and recent editor
  logs automatically.
- This **What's New** page, reachable any time from **Help → What's New**, with a
  short summary that opens automatically the first time you load a new release.
