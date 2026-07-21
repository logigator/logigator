# Components & Options

Components are the building blocks of a circuit — gates, memories, inputs, displays and more. This page covers where to find them, how to place them, and how to configure the one you have selected.

![The component palette open on the left, its categories expanded, next to a small circuit on the board.](images/components-and-options/palette-and-board.png)

## The component palette

The palette is the panel on the left. It lists every component you can place, grouped into categories. Use the search box at the top to filter by name, and click a category header to expand or collapse it.

- **Basic** — the everyday logic building blocks: **NOT Gate**, **AND Gate**, **OR Gate**, **XOR Gate**, **Delay**, **Clock** and **Tunnel**.
- **Advanced** — larger building blocks: adders, memories, flip-flops, and routing parts (see the table below).
- **Inputs / Outputs** — the hardware you interact with while a simulation runs: **Button**, **Switch**, **LED**, **Segment Display** and **LED Matrix**.
- **User Components** — your own reusable parts. This section is empty until you build one; see [Custom Components](docs:custom-components).

A **Ports** category appears only while you are editing a custom component. It holds the **Input** and **Output** plugs you use to define that component's ports — see [Custom Components](docs:custom-components).

To place a component, click it in the palette and it follows your cursor as a ghost; move it where you want and press to drop it. Placing stays armed so you can drop several in a row — press `Escape` or pick another tool to stop. See [Board & Tools](docs:board-and-tools) for more on placing, moving and rotating.

### Basic

| Component    | What it does                                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **NOT Gate** | Inverts its input: HIGH in gives LOW out, and vice versa.                                                                                  |
| **AND Gate** | Output is HIGH only when every input is HIGH.                                                                                              |
| **OR Gate**  | Output is HIGH when at least one input is HIGH.                                                                                            |
| **XOR Gate** | Output is HIGH when an odd number of inputs are HIGH.                                                                                      |
| **Delay**    | Passes its input through unchanged, adding one simulation tick of delay.                                                                   |
| **Clock**    | Emits a repeating one-tick pulse; the delay between pulses is configurable, and driving its STP input HIGH pauses it.                      |
| **Tunnel**   | A wireless connection — all tunnels sharing the same label are electrically joined. See [Wires & Connections](docs:wires-and-connections). |

### Advanced

| Component                   | What it does                                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| **Half Adder**              | Adds two 1-bit numbers; S is the sum bit, C the carry.                                          |
| **Full Adder**              | Adds two summands plus a carry-in; S is the sum bit, C the carry.                               |
| **ROM**                     | Read-only memory whose stored contents you edit by hand.                                        |
| **RAM**                     | Random-access memory: reads the addressed word on a clock edge, or stores one while WE is HIGH. |
| **D Flip-Flop**             | Stores one bit; captures D on the rising edge of CLK.                                           |
| **JK Flip-Flop**            | Stores one bit; J sets, K resets, both toggle, on the rising edge of CLK.                       |
| **SR Flip-Flop**            | Stores one bit; S sets and R resets on the rising edge of CLK.                                  |
| **Random Number Generator** | Produces random data on its outputs on every rising edge of CLK.                                |
| **Decoder**                 | Drives the one output whose index equals the binary value on its inputs.                        |
| **Encoder**                 | Outputs the binary index of its highest powered input.                                          |
| **Multiplexer**             | Routes the data input chosen by the select lines to the single output.                          |
| **Demultiplexer**           | Routes the single data input to the output chosen by the select lines.                          |

### Inputs / Outputs

| Component           | What it does                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| **Button**          | A momentary push button — click it during simulation to emit a single pulse.                     |
| **Switch**          | A latching switch — click it during simulation to toggle its output on and off.                  |
| **LED**             | Lights up while the wire feeding its input is powered.                                           |
| **Segment Display** | Shows the binary value on its inputs as a number in a chosen base.                               |
| **LED Matrix**      | A square grid of LEDs that displays an image, written a row at a time on the rising edge of CLK. |

## Configuring a component

When you select a single placed component — or while you are placing one — a small **settings card** appears by the board showing that component's name, a short description, and its adjustable options. On a touch device the same options open in the **Settings** drawer instead.

![The settings card beside the board showing a selected AND gate's name, description, the Direction arrows and an Inputs stepper.](images/components-and-options/settings-card.png)

### Direction — on every component

Every component has a **Direction** control: four arrows for East, South, West and North. It turns the component to face the way you want, which is the same as rotating it. (You can also rotate a selection on the board with `R` and `Shift+R` — see [Board & Tools](docs:board-and-tools).)

### Type-specific options

Everything beyond Direction depends on the component. Many components have none at all (a NOT gate, for instance). The ones that do:

| Component                                | Options                                                                                  |
| ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| **AND / OR / XOR Gate**, **Decoder**     | **Inputs** — how many input ports.                                                       |
| **Encoder**, **Random Number Generator** | **Outputs** — how many output ports.                                                     |
| **Clock**                                | **Delay** — the number of ticks between pulses.                                          |
| **Tunnel**                               | **Label** — the name that pairs it with other tunnels.                                   |
| **ROM**                                  | **Word Size**, **Address Size**, and **Edit contents** (see below).                      |
| **RAM**                                  | **Word Size** and **Address Size**.                                                      |
| **Multiplexer / Demultiplexer**          | **Select lines** — how many select inputs, which sets the number of data lines.          |
| **Segment Display**                      | **Inputs** — how many input bits — and **Base** — the number base the value is shown in. |
| **LED Matrix**                           | **Width/Height** — the size of the LED grid.                                             |

### Editing ROM contents

Selecting a **ROM** shows an **Edit contents** button. It opens a hex editor where you type the memory's stored words; the **Word Size** and **Address Size** options set how wide each word is and how many words there are. Your edits are saved with the circuit. The same read-only hex view is available while a simulation runs — see [Inspection & Watches](docs:inspection).

## Negating a port

Any input or output port can be **negated** so the signal passing through it is inverted, without adding a separate NOT gate. Pick the **Wire** tool and tap directly on a port: a small **negation bubble** appears on it, and the port is now inverted. Tap it again to remove the bubble.

While the Wire tool is active, hovering near a port previews the bubble a tap would add, so you can see exactly which port you are about to negate.

![Close-up of a gate input with a negation bubble on it, drawn where the port meets the body.](images/components-and-options/port-negation.png)

## Placing text

The palette does not include text — labels are placed with the **Text** tool in the toolbar. Pick it, click the board, and type your note; the label's settings card lets you **Edit text** and change its **Font size**. Wires may pass through a text label without connecting to it.

## See also

- [Wires & Connections](docs:wires-and-connections) — connecting ports into working circuits
- [Custom Components](docs:custom-components) — packaging a circuit into your own reusable part
- [Simulation](docs:simulation) — running the circuit and interacting with buttons, switches and displays
- [Board & Tools](docs:board-and-tools) — placing, selecting, moving and rotating
