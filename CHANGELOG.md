# Changelog

All notable changes to Logigator are recorded here. The most recent release is
listed first.

## [Unreleased]

### 🔄 Changed

- **A tidier What's New.** Each release in the editor's What's New dialog now
  opens with its version and a date written out in your language.

## [2.2.0] - 2026-09-17

### ✨ Added

- **Selections you can add to.** Hold Ctrl — ⌘ on a Mac — and a click adds the
  component or wire under the pointer to the selection, or takes it back out,
  while a selection box adds what it covers to what you already had. Rebind the
  key in the shortcut settings, beside Cut Wires at Selection Edge.
- **Selection inside the Wire Tool.** A tap that hits neither a port nor a
  crossing now selects the smallest element under the pointer, so you can
  delete, copy or nudge it in place.
- **Selection moves with the Pan tool.** Dragging the current selection moves it
  instead of panning the board; a press anywhere else pans as before. The new
  "Drag selection in Pan mode" setting turns this back off.

### 🐛 Fixed

- A double click with the Wire Tool takes back the tap it repeats, so a double
  click on a port draws the wire you were reaching for and leaves no stray
  negation bubble behind.
- Clicking the empty space inside your selection's outline no longer clears it.
- Long menus and their submenus scroll instead of running off the bottom of the
  window on a short screen.
- On Apple platforms in Chromium-based browsers, ⌘ is recognized where Ctrl was
  shown before.

## [2.1.3] - 2026-09-16

### 🐛 Fixed

- Starting a simulation no longer fails when a component's number setting holds a
  decimal value, such as a clock delay of 1.9, or one larger than the simulation
  accepts. Such a circuit loads with the value rounded and capped, and saves back
  as a whole number.
- Placing a custom component now keeps the direction and the options you set for
  it in the settings panel, instead of always dropping it facing the same way and
  discarding them.
- A component you are about to place can be turned before you drop it: press R or
  Shift+R, or use the rotate buttons in the tool bar. A placement you are already
  dragging turns too, and the next component of that type starts in the direction
  you turned this one.

## [2.1.2] - 2026-09-10

### 🐛 Fixed

- Rotating a phone or tablet no longer crashes the editor.
- Repairing wires while a simulation is running no longer crashes the editor. The
  simulation is stopped first.
- A share link to a custom component now opens it the way your own components
  open: named in the title bar, and ready to be cloned into your components.
- Coming back with the browser's back button no longer leaves menus, dropdowns
  and tutorial hints stuck.
- Links inside the editor's help and changelog now jump to the right heading in
  every language.
- Where two port tips meet, tapping with the wire tool now inverts the port on
  the side you tapped instead of the one facing it.
- The editor stays usable when a move or a paste cannot be completed.

## [2.1.1] - 2026-08-31

### 🐛 Fixed

- The editor now opens in the language and theme you use everywhere else on
  Logigator, and switching either one inside the editor changes it across the
  whole site.
- On a first visit, the editor picks its language from every language your
  browser asks for, instead of only the first one.

## [2.1.0] - 2026-08-06

### ✨ Added

- **One-step updates for outdated components.** Bring every placed instance of
  an outdated custom component up to date at once, from the settings panel. The
  palette marks components whose placed instances are behind.
- **A look inside shared components.** Open the custom components embedded in a
  shared circuit, read-only. Nothing is added to your library.

### 🔄 Changed

- Paste no longer needs a selection on phones and tablets, and pasted elements land
  under the cursor instead of where they were copied from.
- The Ports panel now leads the side bar while a custom component is being edited.

### 🐛 Fixed

- Clicking a switch or button while the simulation was still starting up crashed
  the simulation.
- Opening another project while a simulation was running crashed the simulation.
- Clicking inside a floating paste but between its components cancelled the paste
  instead of grabbing it.
- Tooltips and popovers near the edge of the screen pointed their arrow past what
  they were anchored to.

## [2.0.0] - 2026-08-04

Logigator has been **completely rebuilt** — an upgraded renderer, a far more
efficient rendering pipeline, a modern interface, and a wave of new
features. Everything you relied on is still here, now faster, sturdier, and
easier to use, with some big new capabilities on top.

### ✨ Added

- **📱 Full phone and tablet support.** The editor is now fully responsive and
  touch-friendly, with multi-touch pan and zoom — build circuits anywhere, not
  just at a desk.
- **⛔ Negated inputs and outputs.** Invert a signal right at a component's port
  — no separate NOT gate to place and wire — for cleaner, more compact circuits.
- **💾 Local saves without an account.** Keep projects and custom components on
  your own device and pick them up again any time. When you're ready, upload
  them to the cloud with one click and Logigator brings along every custom
  component they depend on.
- **♾️ An infinite canvas in every direction.** Build outward from the origin
  wherever you like — left, right, up, down. The previous editor only had
  positive coordinates, so the origin was a hard wall nothing could be placed
  past; now the canvas simply grows with your circuit.
- **🧩 Self-contained projects.** Every project now carries its own copy of the
  custom components it uses, so it always opens, renders, and simulates — even
  offline or with the original component gone. A missing component can be
  restored to your library in one step.
- **🗺️ Minimap.** A live overview of your whole circuit lets you find your way
  around large designs at a glance.
- **Rotation for whole selections** — components and wires together — in 90°
  steps, clockwise or counter-clockwise; a colliding placement stays floating
  until you drop it somewhere valid.
- **Arrow-key moves** for selections, one grid unit per press.
- **Clear collision feedback** — components and wires turn red while a placement,
  drag, or rotation would overlap something, so invalid positions are obvious at
  a glance.
- **A new file format, with compressed `.lgix` files.** Files from earlier
  versions still open and are upgraded as they load.
- **Project and component management in the editor** — rename and delete your
  saved projects and custom components straight from the open dialog and
  library, instead of heading to the account center on the website.
- **Fork attribution** — a copied circuit remembers where it came from, even
  after a download and re-upload, so the original creator stays credited.
- A **hands-on tutorial** that has you place and wire real components. It moves
  on as soon as you finish a step, runs on its own board so your work stays
  untouched, and works on desktop and touch.
- **Just-in-time hints** that fire the first time you reach a relevant situation
  (wiring, simulating, pasting, and more), each linking into the documentation.
- **In-editor bug reporting** that attaches the details needed to track a
  problem down, so you only have to describe what happened.
- This **What's New** page, reachable any time from **Help → What's New**, with a
  short summary that opens automatically the first time you load a new release.

### 🔄 Changed

- **⚡ A rebuilt foundation.** The rendering pipeline, simulation engine, and
  collision system were all rebuilt from the ground up: GPU-accelerated
  graphics keep large circuits smooth, a new simulation core drives the logic,
  and a more robust collision system makes editing far more stable and less
  bug-prone.
- Refreshed, consistent interface across menus, dialogs, panels, and toasts, with
  a redesigned side-bar workbench.
- **Instant switching between light and dark themes** — no page reload, where
  the previous editor applied the change only after reloading.
- **A grid that marks where things connect** — grid dots now sit exactly on the
  points that wires, port tips, and junctions terminate on, so wires run through
  the dots instead of between them.
- A **simpler, unified tool set**: one wire tool draws wires and, with a tap,
  joins, splits or negates connections; exact selection is part of the select
  tool; and panning has a tool of its own.
- **Component updates on your terms.** When a newer version of a custom
  component is available, the editor flags it and lets you update placed
  instances when you choose, instead of every copy changing the moment the
  component is edited.
- **Restructured in-app documentation**, in sections that link to each other,
  shown as a window on desktop and full screen on phones.

[Unreleased]: https://github.com/logigator/logigator/compare/v2.2.0...HEAD
[2.2.0]: https://github.com/logigator/logigator/compare/v2.1.3...v2.2.0
[2.1.3]: https://github.com/logigator/logigator/compare/v2.1.2...v2.1.3
[2.1.2]: https://github.com/logigator/logigator/compare/v2.1.1...v2.1.2
[2.1.1]: https://github.com/logigator/logigator/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/logigator/logigator/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/logigator/logigator/releases/tag/v2.0.0
