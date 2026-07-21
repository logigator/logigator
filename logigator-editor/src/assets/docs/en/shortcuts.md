# Keyboard Shortcuts

Logigator is faster with the keyboard. Below are the default bindings, followed by how to change them.

> On macOS, `Ctrl` shortcuts use the **⌘ Command** key instead — for example, Save is `⌘S`.

## File

| Action | Shortcut |
| --- | --- |
| Save | `Ctrl+S` |
| Open | `Ctrl+O` |
| New Component | `Alt+N` |

## Edit

| Action | Shortcut |
| --- | --- |
| Undo | `Ctrl+Z` |
| Redo | `Ctrl+Shift+Z` |
| Copy | `Ctrl+C` |
| Cut | `Ctrl+X` |
| Paste | `Ctrl+V` |
| Delete | `Delete` |
| Rotate Clockwise | `R` |
| Rotate Counter-Clockwise | `Shift+R` |
| Move Selection Up | `↑` |
| Move Selection Down | `↓` |
| Move Selection Left | `←` |
| Move Selection Right | `→` |

## View

| Action | Shortcut |
| --- | --- |
| Zoom In | `Ctrl++` |
| Zoom Out | `Ctrl+-` |
| Zoom 100% | `Ctrl+0` |

## Tools

| Action | Shortcut |
| --- | --- |
| Pan | `P` |
| Wire Tool | `W` |
| Select | `S` |
| Erase | `E` |
| Place Text | `T` |
| Cut Wires at Selection Edge (hold) | `Alt` |

## Interaction

| Action | Shortcut |
| --- | --- |
| Start / Stop Simulation | `Enter` |
| Cancel | `Escape` |

## Held shortcuts

Most shortcuts fire once when you press them. A few are **held** instead: you keep the key down while doing something else. The main one is **Cut Wires at Selection Edge** — hold `Alt` while dragging a selection box with the [select tool](docs:board-and-tools) and wires are cut at the box edge for as long as the key is down.

## Changing your shortcuts

Open **Edit → Keyboard Shortcuts** to see every action and its current binding.

![The keyboard shortcut manager dialog, listing actions grouped by File, Edit, View, Tools and Interaction, each with its assigned key and Edit / Reset controls.](images/shortcuts/shortcut-manager.png)

For any action you can:

- **Edit** — click it, then press the key combination you want. The manager records exactly what you press.
- **Unassign** — leave an action with no shortcut at all.
- **Reset** — restore that action's default binding, or use **Reset All** to restore every default.

If you assign a combination that's already used by another action, it's taken away from that action (Logigator tells you which one) so no two actions ever share a binding.

Your custom bindings are remembered in this browser. Clearing the browser's site data resets them to the defaults.

## See also

- [Board & Tools](docs:board-and-tools) — the tools and actions these shortcuts trigger
- [Getting Started](docs:getting-started) — a tour of the editor
