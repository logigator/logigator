# Simulation

Once your circuit is built, run it to watch the signals flow. In simulation you power the circuit, flip its inputs, and see the results light up live on the board.

![A circuit running in simulation, with the run controls in the toolbar.](./images/simulation-showcase.webp)

## Starting and leaving a simulation

Press the **Start simulation** button at the far right of the toolbar to power your circuit. You can also press `Enter`.

While a simulation runs the board is **locked for editing** — you can't place, move, wire or delete anything. You can still pan and zoom freely, and you can click the circuit's inputs (see [Interacting with a running circuit](#interacting-with-a-running-circuit)).

To go back to editing, press **Exit simulation** (where the Start button was), or press `Enter` again or `Escape`.

Whether the simulation begins **running** or begins **paused** depends on the **Auto-start simulation** setting. When it's on, the circuit starts running the moment you enter; when it's off, it enters paused so you can start it yourself. See [Settings & Appearance](docs:settings).

## The run controls

When a simulation is active, the toolbar swaps its drawing tools for the run controls.

| Control   | What it does                                                                                                                |
| --------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Run**   | Starts (or resumes) the simulation.                                                                                         |
| **Pause** | Freezes the simulation where it is, keeping its current state so you can resume or step.                                    |
| **Step**  | Advances the circuit by a single tick. Available while paused — handy for tracing a signal one step at a time.              |
| **Stop**  | Resets the circuit back to the start and clears every lit wire. The simulation stays active and paused, ready to run again. |

**Stop** and **Exit simulation** are different: **Stop** rewinds the running circuit to the beginning but keeps you in simulation, while **Exit simulation** leaves simulation entirely and returns you to editing.

![The run controls and the speed settings in the toolbar.](./images/simulation-controls.webp)

## Simulation speed

Beside the run controls is the **speed button**. It names the current setting — **Every frame**, a rate such as `10 Hz`, or **Max speed** — and clicking it opens the speed panel:

![The speed panel, opened from the speed button, with Fixed speed chosen.](./images/simulation-speed.webp)

The panel offers three ways to pace the simulation. The highlighted one is in use; click another to switch, even while the circuit runs:

- **Every frame** — the circuit advances one tick per screen refresh, so every change is drawn and the speed follows your display's refresh rate. This is the default.
- **Fixed speed** — the circuit ticks at a rate you choose. Drag the slider to pick one between `1 Hz` and `10 MHz`, or type it into the box beside the slider: `20`, `2.5k` and `1M` all work. Typing also goes below the slider, down to `0.1 Hz` — one tick every ten seconds. Changing either one selects **Fixed speed**. If the box turns red, what you typed is not a rate, and the simulation keeps running at the last one that was.
- **As fast as possible** — no limit: the circuit runs as fast as your computer allows, and the screen shows only some of the ticks.

Under the three choices, **Clocks at this speed** lists the frequency each **Clock** in your circuit runs at. A clock's **Delay** is how many ticks it waits before flipping, so a full cycle takes twice that: at `10 Hz`, a clock with delay `1` runs at `5 Hz`. To slow a clock down, lower the speed or raise its delay. With a fixed speed the list is there straight away; with the other two it appears once the circuit has run for a moment, since their speed is only known by measuring it.

Next to the speed button, a readout shows the **measured speed** the simulation is actually reaching while it runs, alongside the total **ticks** elapsed since it started. When a fixed speed is more than the circuit can keep up with, the readout is marked with a warning sign.

## Interacting with a running circuit

Only the circuit's inputs respond to clicks while it runs:

- **Switch** — a latching input. Click it to toggle its output on or off; it stays where you left it.
- **Button** — a momentary input. Its output is on for as long as you hold it down, and goes off again when you let go.
- **Pulse button** — click it to emit a single one-tick pulse on its output.

As signals propagate, powered wires and ports **light up**, and output components show their state — LEDs glow, segment displays and LED matrices show their patterns. Drag anywhere on the board to pan — except from a button, which simply stays held down; clicking empty space does nothing.

To look inside a running circuit — read a memory's contents or watch a custom component's inner circuit live — see [Inspection & Watches](docs:inspection).

## When a simulation won't start

Some problems stop a circuit from simulating at all. If any are present, **Start simulation** shows an error message and stays in editing mode so you can fix them. The most common ones:

- **An unsupported component** — a component the simulator can't run. Remove or replace it.
- **A custom component that places itself** — a [custom component](docs:custom-components) whose inner circuit contains itself, directly or through another custom, which can never resolve. Break the loop.
- **A custom component with no circuit** — a custom component that has nothing inside it to simulate. Give it an inner circuit, or remove it.
- **A port mismatch** — a custom component whose declared input/output ports don't match the input and output plugs actually inside its circuit. Line the plugs up with the ports.

Each message names the component involved so you can find it.

## See also

- [Inspection & Watches](docs:inspection) — reading memory and watching inner circuits live
- [Components & Options](docs:components-and-options) — switches, buttons, LEDs and other building blocks
- [Custom Components](docs:custom-components) — packaging a circuit into a reusable part
- [Settings & Appearance](docs:settings) — the Auto-start simulation option
- [Keyboard Shortcuts](docs:shortcuts) — every binding, and how to change them
