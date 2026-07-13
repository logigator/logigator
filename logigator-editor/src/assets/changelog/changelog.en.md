# Changelog

All notable changes to the Logigator editor are recorded here. The most recent
release is listed first.

## 2.0.0 — 2026-07-13

A complete rebuild of the Logigator editor, replacing the previous version with
a faster canvas, a redesigned workspace, and a large set of new capabilities.

### Editor

- Rebuilt on a new high-performance canvas, with smoother panning, zooming, and
  rendering of large circuits.
- Redesigned side-bar workbench with searchable, grouped components.
- Minimap for navigating large circuits at a glance.
- Reworked selection: marquee, move, copy/cut/paste, and multi-step undo/redo.

### Simulation

- Live circuit simulation with interactive levers and buttons.
- Custom-component **watches** — open a live, interactive view of a component's
  inner circuit while a simulation runs, with breadcrumb drill-down into nested
  components.
- Live inspection of components such as ROM during simulation.

### Components & files

- Custom component library with cloud promotion and dependency tracking.
- Native, versioned local file format for saving and loading circuits, plus
  gzipped `.lgix` export.
- Image and preview export for sharing circuits outside the editor.
- Share links for projects and cloud components.

### What's New

- This page, reachable any time from **Help → What's New**, with a short summary
  that opens automatically the first time you load a new release.
