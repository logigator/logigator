# Components and options

Components are the parts a circuit is made of: gates, memories, inputs and displays. You pick them from the palette on the left and set their options in the settings card. This page lists every built-in component and links to its description.

![The component palette.](./images/component-palette.webp)

## The palette {#the-palette}

The search field at the top filters the palette by name. The categories are Logic gates, Inputs, Outputs, Adders and selectors, Memory and Timing, plus User Components once you have built a [custom component](docs:custom-components). Click a category header to fold it; the palette remembers which ones you fold. How placing works is described in [Board and tools](docs:board-and-tools#placing-components).

Every component takes one tick to pass a change on to its output. The tables below follow the order of the palette.

### Logic gates {#logic-gates}

| Component                                    | What it does                                                        |
| -------------------------------------------- | ------------------------------------------------------------------- |
| [NOT Gate](docs:logic-gates#not-gate)        | Inverts its input.                                                  |
| [AND Gate](docs:logic-gates#and-gate)        | Outputs 1 when every input is 1.                                    |
| [OR Gate](docs:logic-gates#or-gate)          | Outputs 1 when at least one input is 1.                             |
| [XOR Gate](docs:logic-gates#xor-gate)        | Outputs 1 when an odd number of inputs are 1.                       |
| [Tunnel](docs:wires-and-connections#tunnels) | Connects to every other tunnel with the same label, without a wire. |

### Adders and selectors {#adders-and-selectors}

| Component                                                | What it does                                                    |
| -------------------------------------------------------- | --------------------------------------------------------------- |
| [Half Adder](docs:adders-and-selectors#half-adder)       | Adds two bits.                                                  |
| [Full Adder](docs:adders-and-selectors#full-adder)       | Adds two bits and a carry-in.                                   |
| [Multiplexer](docs:adders-and-selectors#multiplexer)     | Passes the data input chosen by the select lines to its output. |
| [Demultiplexer](docs:adders-and-selectors#demultiplexer) | Passes its input to the output chosen by the select lines.      |
| [Decoder](docs:adders-and-selectors#decoder)             | Turns on the one output whose number is on the inputs.          |
| [Encoder](docs:adders-and-selectors#encoder)             | Outputs the number of the highest input that is 1.              |

### Memory {#memory}

| Component                                | What it does                                                           |
| ---------------------------------------- | ---------------------------------------------------------------------- |
| [D Flip-Flop](docs:memory#d-flip-flop)   | Stores D on the rising edge of CLK.                                    |
| [JK Flip-Flop](docs:memory#jk-flip-flop) | Sets, resets or toggles a bit on the rising edge of CLK.               |
| [SR Flip-Flop](docs:memory#sr-flip-flop) | Sets or resets a bit on the rising edge of CLK.                        |
| [ROM](docs:memory#rom)                   | Outputs the stored word at the address on its inputs.                  |
| [RAM](docs:memory#ram)                   | Stores the words the circuit writes and outputs the one at an address. |

### Timing {#timing}

| Component                                                                | What it does                                                        |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| [Clock](docs:clock-and-timing#clock)                                     | Switches between 0 and 1 by itself, as a square wave or as a pulse. |
| [Delay](docs:clock-and-timing#delay)                                     | Passes its input through unchanged, one tick later.                 |
| [Random Number Generator](docs:clock-and-timing#random-number-generator) | Puts a new random value on its outputs on every rising edge of CLK. |

### Inputs {#inputs}

| Component                                | What it does                                                        |
| ---------------------------------------- | ------------------------------------------------------------------- |
| [Switch](docs:inputs#switch)             | Toggles between 0 and 1 with each click during a simulation.        |
| [Button](docs:inputs#button)             | Outputs 1 for as long as you hold it down.                          |
| [Pulse button](docs:inputs#pulse-button) | Outputs a one-tick pulse per click.                                 |
| [Gamepad](docs:inputs#gamepad)           | One output per button of a controller you play during a simulation. |
| [Keyboard](docs:inputs#keyboard)         | Puts the code of each key you type on its outputs.                  |

### Outputs {#outputs}

| Component                                       | What it does                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------- |
| [LED](docs:outputs#led)                         | Lights up while its input is 1.                                     |
| [Segment Display](docs:outputs#segment-display) | Shows the binary number on its inputs in decimal, hex or octal.     |
| [LED Matrix](docs:outputs#led-matrix)           | A square grid of LEDs, written one row at a time.                   |
| [Terminal](docs:outputs#terminal)               | A text screen that prints one character on each rising edge of CLK. |

## The settings card {#the-settings-card}

Selecting a single component, or picking one to place, shows its settings card next to the board: the name, a description, and the options. The card is hidden during a simulation.

![The settings card of a selected AND gate.](./images/component-settings.webp)

- Direction, which every component has, has four arrow buttons that turn the component. A direction chosen while placing is kept for the next component of that type.
- Changing Inputs, Outputs or a size option changes the number of ports right away.
- The other options are described with each component, such as the contents of a [ROM](docs:memory#rom), the button names of a [Gamepad](docs:inputs#gamepad) and the screen size of a [Terminal](docs:outputs#terminal).

## Negating a port {#negating-a-port}

With the Wire tool, tap an input or output port to add a negation bubble. The signal through that port is then inverted, with no extra delay. Tap the bubble again to remove it. While you hover a port, the Wire tool shows what a tap would do. A bubble on a [flip-flop's](docs:memory) CLK input makes it react to the falling edge instead.

Tunnels, Input and Output plugs and the ports of a placed custom component can't be negated.

![An OR gate with a negated output.](./images/negated-gate.webp)

## Text labels {#text-labels}

Text isn't in the palette. With the Text tool (`T`), click the board to place a label reading "[insert text]". Edit text in its settings card opens a dialog for the text, which can run over several lines, and Font size ranges from 2 to 128. Wires pass through labels without connecting. Clicking a wire that runs under a label selects the wire.

## See also {#see-also}

- [Logic gates](docs:logic-gates): the first of the component pages
- [Inputs](docs:inputs): switches, buttons, the gamepad and the keyboard
- [Wires and connections](docs:wires-and-connections): connecting ports
- [Custom components](docs:custom-components): building your own parts
- [Board and tools](docs:board-and-tools): placing, moving and rotating
