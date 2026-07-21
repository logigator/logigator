# Custom Components

A custom component packages a whole circuit into a single reusable part with its own symbol and named ports. Build a counter or an ALU once, then drop it into bigger circuits as one tidy block.

![A custom component placed on the board as a single labeled box with input and output ports, sitting next to the gates it replaces.](images/custom-components/instance-on-board.png)

## Creating a component

Choose **File → New Component** to open the new-component dialog. Fill in:

- **Name** — what the component is called in your library and palette.
- **Symbol** — a short label drawn on the component's box.
- **Description** — an optional note about what it does.
- **Store** — where it lives: **Cloud** (your Logigator account, reachable from any device) or **Local** (this browser only). Cloud storage needs you to be signed in; local components are not synced between devices and may be lost.

Choosing **Create** opens the new component in its own tab, with an empty board ready for you to build its circuit.

## Defining inputs and outputs

Inside a component's editor, the palette gains a **Ports** category holding two plugs:

- **Input** — defines one input port on the finished component.
- **Output** — defines one output port.

Place an Input or Output plug for each port you want, then wire it into your circuit like any other component. Select a plug and set its **Label** in the settings card — that label names the port and is shown on the component's box when it is placed. The order of the plugs sets the order of the ports.

A dedicated **Ports** panel lists the inputs and outputs you have defined so far, so you can keep track as the component takes shape.

![A component editor tab open, with Input and Output plugs placed around a small circuit and the Ports panel listing the defined ports.](images/custom-components/defining-ports.png)

## Placing your components

Saved custom components appear in the palette under **User Components**. Place one exactly like a built-in part: click it and drop it on the board. It appears as a single box carrying your symbol, with a port for each Input and Output plug you defined.

A placed component is a self-contained copy of the circuit as it was when you placed it, so your circuits keep working even if you later change or remove the original.

## Editing a component and updating instances

To change a custom component's circuit, open it in its own tab: choose **Edit circuit** from its settings card while an instance is selected, or open it from your library. To change its name, symbol or description instead, choose **Edit details**. Editing the component does **not** automatically change parts you already placed — each placed instance stays as it was.

When a placed instance is behind the latest version of its component, its settings card offers **Update to latest**. Choosing it swaps that instance for the current version, keeping its position and direction. Updating is per-instance and can be undone, so you decide exactly which copies move forward.

## Nesting and dependencies

A custom component can contain other custom components, so you can build up from small parts to large ones. Logigator prevents loops: a component can never contain itself, directly or indirectly, so while you are editing one, the components that would create such a loop are unavailable in the palette.

When you save or share a component, the parts it uses travel with it, so it always opens complete on another device or in someone else's library.

## Sharing and looking inside

- To move a local component to your account, or to share it with a link, see [Cloud & Sharing](docs:cloud). Saving a cloud component that uses local parts publishes those parts to your cloud library first.
- To peek inside a running instance and watch its internal signals, see [Inspection & Watches](docs:inspection).
- To remove a component from your library, use **Delete** in its settings card. Copies you already placed stay as embedded parts you can restore later.

## See also

- [Components & Options](docs:components-and-options) — the built-in parts your components are made of
- [Wires & Connections](docs:wires-and-connections) — wiring plugs into your component's circuit
- [Inspection & Watches](docs:inspection) — watching a running instance from the inside
- [Cloud & Sharing](docs:cloud) — publishing and sharing your components
- [Saving & Files](docs:saving-and-files) — how circuits and their components are stored
