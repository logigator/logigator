# Getting Started

Welcome to Logigator — an open-source editor and simulator for digital logic circuits that runs entirely in your browser.

![The Logigator editor at a glance: the circuit board fills the center, the toolbar runs across the top, the component palette sits in the panel on the left, and the status bar spans the bottom.](images/getting-started/editor-overview.png)

## What is Logigator?

Logigator lets you draw digital logic circuits — from a single AND gate to a full processor — and then run them to watch the signals flow. You place components on a grid, wire their ports together, and press play to simulate.

You can:

- Build circuits from logic gates, flip-flops, memories, multiplexers, displays and more
- Wire components into nets and see powered wires light up during simulation
- Package a finished circuit into your own reusable [custom component](docs:custom-components)
- Save your work in this browser, [export it to a file](docs:saving-and-files), or keep it in your [Logigator account in the cloud](docs:cloud)

Everything works without an account. Signing in adds cloud storage and share links.

## A tour of the editor

The editor is organized into a few fixed areas around the central board:

- **The board** — the grid in the middle where you place components and draw wires. Scroll to zoom and drag to pan.
- **The toolbar** (across the top) — quick actions on the left (save, open, copy/paste, undo/redo, zoom) and the drawing tools on the right (pan, wire, select, erase, text). The **Start simulation** button sits at the far right.
- **The menu bar** (top-left) — the **File**, **Edit**, **View** and **Help** menus. Every command lives here, most with a keyboard shortcut shown beside it.
- **The component palette** (left panel) — all the components you can place, grouped into categories. See [Components & Options](docs:components-and-options).
- **The status bar** (bottom) — a one-line hint for the active tool, your cursor position on the grid, whether the project has unsaved changes, and how many elements are selected.
- **The minimap** (bottom-right) — a small overview of the whole circuit that you can collapse.

The project's name sits next to the menus at the top; click it to rename the project, and the chip beside it shows where the project is stored (**Local**, **Cloud**, **Draft** or **Shared**).

![The top of the editor, with the File/Edit/View/Help menu bar, the editable project name and its source chip, and the toolbar of tools and actions labeled.](images/getting-started/toolbar-and-menus.png)

## The guided tutorial

The fastest way to learn the basics is the built-in tutorial, which walks you through building a small working circuit in about a minute.

The first time you open the editor, a card appears near the top of the board: **"New here? Build your first circuit in a quick tutorial."** Choose **Start tutorial** to begin, or **Dismiss** to skip it. You can skip the tutorial at any point once it has started.

To run it again later — or bring back the contextual tips described below — open **Help → Show tips again**.

## Just-in-time tips

As you reach for a tool for the first time, Logigator shows a short tip explaining how it works — for example, how the [wire tool](docs:wires-and-connections) draws and toggles connections, or what the scissor select does. Each tip can be dismissed, and it won't come back once you've seen it.

To turn tips off entirely, open the account menu in the top-right and toggle off **Show onboarding tips** in **Editor Settings**, or choose **Turn off all tips** from any tip. See [Settings & Appearance](docs:settings).

## Keeping up with changes

Logigator is updated regularly. Open **Help → What's New** to see a summary of what changed in recent releases. The first time a new version introduces something worth knowing, this appears automatically.

## Reporting a problem

Found a bug? Use the **Report a bug** button in the bottom-right corner of the board. Describe what you were doing when it happened — your current project, browser details and recent activity are attached to help track the issue down. If an unexpected error ever interrupts you, the same report window opens on its own.

## Version & license info

**Help → About** shows the exact version you're running, along with the build details, the license (Logigator is free software under the **GNU AGPL v3**), and links to the source repository and privacy policy.

## See also

- [Board & Tools](docs:board-and-tools) — moving around, placing components, selecting and erasing
- [Components & Options](docs:components-and-options) — the building blocks and how to configure them
- [Wires & Connections](docs:wires-and-connections) — connecting components into working circuits
- [Simulation](docs:simulation) — running your circuit and interacting with it
- [Keyboard Shortcuts](docs:shortcuts) — every binding, and how to change them
