# Simulation

Once your circuit is built, run it to watch the signals flow. In simulation you power the circuit, flip its inputs, and see the results light up live on the board.

![The editor in simulation, with powered wires and ports lit up, an LED glowing, and the run controls in the toolbar.](images/simulation/simulation-running.png)

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

![Close-up of the run controls in the toolbar: Run, Pause, Step and Stop, followed by the speed controls and the live speed readout.](images/simulation/run-controls.png)

## Simulation speed

Beside the run controls is a set of speed options and a live readout. There are three ways to pace the simulation:

- **Sync to frame** — the circuit advances one tick per drawn frame, so its speed follows your display's refresh rate. This is the default and keeps fast-changing circuits easy to watch.
- **Limit to target speed** — the circuit is paced to a fixed frequency you choose. Type a number in the speed box and pick its unit (`Hz`, `kHz` or `MHz`) from the dropdown. Turn on the **Limit to target speed** button to use it.
- **Free run** — with neither **Sync to frame** nor **Limit to target speed** turned on, the circuit runs as fast as it possibly can.

The readout to the right shows the **measured speed** the simulation is actually reaching (for example `1kHz`) alongside the total **ticks** elapsed since it started. The measured speed can fall short of a target you set if the circuit is too large to keep up.

## Interacting with a running circuit

Only the circuit's inputs respond to clicks while it runs:

- **Switch** — a latching input. Click it to toggle its output on or off; it stays where you left it.
- **Button** — a momentary input. Click it to emit a single pulse on its output.

As signals propagate, powered wires and ports **light up**, and output components show their state — LEDs glow, segment displays and LED matrices show their patterns. Drag anywhere on the board to pan; clicking empty space does nothing.

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
