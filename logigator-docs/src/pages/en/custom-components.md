# Custom components

A custom component turns a circuit into a single part with its own symbol and named ports. Build a counter once, and every copy of it on the board is one box instead of a dozen gates.

![A gate circuit and the custom component made from it, running side by side.](./images/custom-component-showcase.webp)

## Creating a component {#creating-a-component}

1. Choose File → New Component (`Alt+N`), or the New Component button in the toolbar. A dialog opens.
2. Fill in the dialog:
   - Name, up to 20 characters, is how the component appears in the palette.
   - Symbol, up to 5 characters, is drawn on its box.
   - Description is optional.
   - Store decides where the component is kept. Local keeps it in this browser. Cloud keeps it in your account and needs you to be signed in; it also asks who can open it, with Everyone preselected (see [Cloud and sharing](docs:cloud#sharing)).
3. Click Create. The component opens in a new tab with an empty board.
4. Build its circuit and give it [ports](#ports).
5. Save (`Ctrl+S`) in that tab to save the component.

## Ports {#ports}

While a component's tab is active, a Ports panel sits above the palette. Place Input and Output plugs from it and wire them into the circuit. Each plug becomes one port of the finished component.

The panel lists the plugs. Type into a row to name the port, with up to 5 characters, which is shown next to the port on the component's box. Drag the rows to change the order of the ports; where the plugs sit on the board doesn't matter.

![A component's tab with its Input and Output plugs.](./images/custom-component-tab.webp)

## Placing and updating {#placing-and-updating}

Saved components appear in the palette under User Components, the most recently edited first. Place them like any other part. Each copy on the board is a box with the symbol and one port per plug.

A placed copy keeps the circuit the component had when you placed it. Editing the component later changes none of the copies until you update them. The palette tile carries an arrow while copies are outdated.

The settings card of a placed copy, or of the palette tile, has these actions:

| Action               | What it does                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| Update to latest     | Updates this copy. Only on an outdated copy.                                                         |
| Update all instances | Updates every outdated copy in the open circuit. The count is in brackets.                           |
| Edit circuit         | Opens the component's circuit to change it.                                                          |
| Edit details         | Changes the name, symbol and description. Placed copies keep the old details until you update them.  |
| Upload to cloud      | Moves a local component to your account. See [Cloud and sharing](docs:cloud#uploading-to-the-cloud). |
| Share                | Opens the share dialog of a cloud component. See [Cloud and sharing](docs:cloud#sharing).            |
| Delete               | Removes the component from your library. See [Deleting](#deleting).                                  |
| Restore & edit       | Only on a copy whose component was deleted. Brings it back into your local library.                  |

Both updates can be undone.

## Nesting {#nesting}

Components can contain other components. A component can never contain itself, directly or through another one, so while you edit one, the palette hides every component that would create such a loop.

When you save, share or export a circuit, the components it uses are included, so it opens complete anywhere.

## Deleting {#deleting}

Delete in the settings card removes the component from your library. Copies already placed stay in their circuits and show an Embedded chip. Restore & edit on such a copy brings it back into your local library. Deleting a cloud component also stops its share link from working.

## See also {#see-also}

- [Components and options](docs:components-and-options): the built-in parts
- [Inspection and watches](docs:inspection): looking inside a running copy
- [Cloud and sharing](docs:cloud): uploading and sharing components
- [Saving and files](docs:saving-and-files): how components travel in files
