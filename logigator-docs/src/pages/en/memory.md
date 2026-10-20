# Memory

A flip-flop stores one bit. ROM and RAM store words of several bits, each at a numbered address. All five are in the Memory category of the palette.

A flip-flop changes its bit only when its CLK input rises from 0 to 1, and Q carries the bit and !Q its inverse. Every flip-flop starts with Q at 0 and !Q at 1. Between rising edges, changes on the other inputs have no effect. A negation bubble on CLK makes a flip-flop react to the falling edge instead, when CLK goes from 1 to 0 (see [Negating a port](docs:components-and-options#negating-a-port)). A [Clock](docs:clock-and-timing#clock) is the usual source for CLK.

A ROM holds contents you set while editing, and the circuit can only read them. A RAM starts out empty and the circuit writes it. During a simulation, clicking a ROM or a RAM opens a viewer with its contents (see [Inspection and watches](docs:inspection)).

## D Flip-Flop

![A D flip-flop with switches on D and CLK and LEDs on Q and !Q. Q takes the value of D when CLK rises and keeps it when D changes while CLK is 0.](./images/component-d-flip-flop.webp)

The D flip-flop stores the bit on D on each rising edge of CLK.

| Port | Direction | Meaning                             |
| ---- | --------- | ----------------------------------- |
| D    | in        | The bit to store.                   |
| CLK  | in        | Stores D when it rises from 0 to 1. |
| Q    | out       | The stored bit.                     |
| !Q   | out       | The inverse of Q.                   |

It has no options besides Direction.

| D   | Q after the rising edge |
| --- | ----------------------- |
| 0   | 0                       |
| 1   | 1                       |

## JK Flip-Flop

![A JK flip-flop with switches on J, CLK and K and LEDs on Q and !Q. On successive rising edges of CLK it is set with J on, reset with K on, then toggled twice with J and K both on.](./images/component-jk-flip-flop.webp)

The JK flip-flop sets, resets or toggles its bit on each rising edge of CLK.

| Port | Direction | Meaning                                    |
| ---- | --------- | ------------------------------------------ |
| J    | in        | Sets the bit.                              |
| CLK  | in        | Applies J and K when it rises from 0 to 1. |
| K    | in        | Resets the bit.                            |
| Q    | out       | The stored bit.                            |
| !Q   | out       | The inverse of Q.                          |

It has no options besides Direction.

| J   | K   | Q after the rising edge |
| --- | --- | ----------------------- |
| 0   | 0   | Unchanged               |
| 1   | 0   | 1                       |
| 0   | 1   | 0                       |
| 1   | 1   | Inverted                |

With J and K both at 1, Q changes on every rising edge, so it runs at half the frequency of the signal on CLK.

## SR Flip-Flop

![An SR flip-flop with switches on S, CLK and R and LEDs on Q and !Q. A rising edge with S on sets Q, and a rising edge with R on resets it.](./images/component-sr-flip-flop.webp)

The SR flip-flop sets or resets its bit on each rising edge of CLK.

| Port | Direction | Meaning                                    |
| ---- | --------- | ------------------------------------------ |
| S    | in        | Sets the bit.                              |
| CLK  | in        | Applies S and R when it rises from 0 to 1. |
| R    | in        | Resets the bit.                            |
| Q    | out       | The stored bit.                            |
| !Q   | out       | The inverse of Q.                          |

It has no options besides Direction.

| S   | R   | Q after the rising edge | !Q after the rising edge |
| --- | --- | ----------------------- | ------------------------ |
| 0   | 0   | Unchanged               | Unchanged                |
| 1   | 0   | 1                       | 0                        |
| 0   | 1   | 0                       | 1                        |
| 1   | 1   | 1, conflict             | 0, conflict              |

S and R both at 1 is an input an SR flip-flop does not allow. The simulation sets Q to 1 and !Q to 0 and draws both output wires orange until a rising edge with only S or only R at 1. See [Conflicting signals](docs:simulation#conflicting-signals). Where both can be 1 at once, use a D or JK flip-flop instead.

## ROM

![A ROM with four switches on its address inputs set to address 3 and four LEDs on its outputs showing the stored word 0111.](./images/component-rom.webp)

The ROM outputs the word stored at the address on its A inputs. It has no clock: the outputs follow the address. The contents can't change while the simulation runs.

| Port      | Direction | Meaning                                           |
| --------- | --------- | ------------------------------------------------- |
| A1, A2, … | in        | The address, A1 being the lowest bit.             |
| O1, O2, … | out       | The word at the address, O1 being the lowest bit. |

| Option        | Values               | Default |
| ------------- | -------------------- | ------- |
| Word Size     | 1 to 64              | 4       |
| Address Size  | 1 to 11              | 4       |
| Edit contents | Opens the hex editor | Empty   |

Word Size sets how many bits a word has, and so the number of outputs. Address Size sets the number of address inputs. A ROM holds 2ⁿ words for an Address Size of n: 16 words by default, 2,048 at most.

### Editing the contents

Edit contents, in the settings card, shows how many words are set, such as 3 of 16 words set, or Empty. Clicking it opens Edit ROM contents, a table with one cell per word. Words you don't set are 0.

- Words or Bytes chooses whether a cell is one word or one byte of the contents.
- Hex, Decimal, Octal or Binary chooses the number base for showing and typing values.
- The Address… field jumps to an address you type in hex.
- Pasting into a cell fills it and the cells after it, one value each, so you can paste a list of values separated by spaces or line breaks.
- Copy puts the whole table on the clipboard as text.
- Clear sets every word to 0, after asking.
- Save keeps the changes and Cancel drops them.

The contents are saved with the circuit. During a simulation, the ROM's viewer highlights the word at the current address (see [ROM contents](docs:inspection#rom-contents)).

## RAM

![A RAM with Address Size 2, switches on A0, A1, D0 to D3, WE and CLK, and LEDs on its outputs. 0101 is stored at address 0 when CLK rises with WE on, stays on the outputs after the data switches are cleared, disappears when address 1 is selected and comes back with address 0.](./images/component-ram.webp)

The RAM outputs the word stored at the address on its A inputs. On the rising edge of CLK, it stores the word on its D inputs at that address while WE is 1.

| Port      | Direction | Meaning                                                      |
| --------- | --------- | ------------------------------------------------------------ |
| A0, A1, … | in        | The address, A0 being the lowest bit.                        |
| D0, D1, … | in        | The word to store, D0 being the lowest bit.                  |
| WE        | in        | Write enable. While it is 1, a rising edge on CLK stores.    |
| CLK       | in        | Stores the D inputs when it rises from 0 to 1 while WE is 1. |
| D0, D1, … | out       | The word at the address, D0 being the lowest bit.            |

The data inputs and the outputs carry the same labels, on opposite sides of the component.

| Option       | Values              | Default   |
| ------------ | ------------------- | --------- |
| Word Size    | 1 to 64             | 4         |
| Address Size | 1 to 16             | 4         |
| Read         | Immediate, On clock | Immediate |

Word Size sets how many bits a word has, and so the number of data inputs and outputs. A RAM holds 2ⁿ words for an Address Size of n: 16 words by default, 65,536 at most.

Read decides when the outputs change:

| Read      | The outputs change                                                                              |
| --------- | ----------------------------------------------------------------------------------------------- |
| Immediate | Whenever the address changes or a new word is stored at it.                                     |
| On clock  | Only on the rising edge of CLK, which reads the word at the address or shows the one it stored. |

With a negation bubble on CLK, the RAM stores, and reads with On clock, on the falling edge instead (see [Negating a port](docs:components-and-options#negating-a-port)).

Every word is 0 when the simulation starts, and Stop sets them all back to 0. The contents are not saved with the circuit; to start with fixed contents, use a ROM. During a simulation, the RAM's viewer shows what the circuit has stored (see [RAM contents](docs:inspection#ram-contents)).

## See also

- [Components and options](docs:components-and-options): negating a port, such as CLK
- [Timing](docs:clock-and-timing): clock signals for CLK
- [Inspection and watches](docs:inspection): viewing ROM and RAM contents during a simulation
- [Adders and selectors](docs:adders-and-selectors): decoders and multiplexers for addressing
- [Logic gates](docs:logic-gates): combining bits without storing them
- [Simulation](docs:simulation): stepping through a circuit tick by tick
