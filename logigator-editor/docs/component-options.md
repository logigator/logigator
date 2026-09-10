# Component Options

A `ComponentOption<T>` is the live, renderer-bearing half of one configurable
value on a circuit component (number of inputs, a port label, a ROM's
contents). It holds the value, clamps writes, fires `onChange$`, and names the
Angular component that renders it in the side panel. `Component`'s base
constructor subscribes every option's `onChange$`, so a write re-derives arity,
labels and body extent through the geometry functions.

Rotation is **not** an option: `direction` is first-class `Component` state, and
the settings panel renders a fixed direction row above the option rows (see
`ui.md`).

`component-options/` holds one folder per kind — `memory-data/`, `number/`,
`select-button/`, `select-dropdown/`, `text-area/`, `text-input/` — each with
`<kind>.component-option.ts` (model) beside
`<kind>-option-input.component.{ts,html}` (renderer).

## Where an option's constraints live

Each class pairs with one kind of pure `OptionSchema` in `@logigator/core`
(`catalog/option-schema.ts`): `number`, `select-button`, `select-dropdown`,
`text`, `textarea`, `memory`. The schema owns the constraints (range, allowed
values, max length, forbidden characters, default, `hidden`); the class adds the
renderer, the live value and the clamping setter. `optionFromSchema` in
`components/config-from-meta.ts` owns the one kind → class table, so a built-in's
config never instantiates an option itself. The split lets the server reject an
illegal value with `validateOptionValue(schema, value)` — the same check the
automation write path runs — without importing anything Angular.

A `forbiddenChars` regex is rebuilt per config, never shared: a `/g` instance
carries `lastIndex` between the sanitizing calls on every write.

## Cloning and cross-cutting flags

`clone(initialValue?)` is a template method: it calls the subclass's
`protected cloneWithValue`, then copies cross-cutting flags. Subclasses
implement `cloneWithValue`, never `clone`; the polymorphic `this` return keeps
the concrete subtype.

The one cross-cutting flag is `inspectorHidden` (from the schema's `hidden`, or
fluently via `.hideFromInspector()`). Such an option still round-trips through
the wire format but is filtered out of the rendered form — used for a plug's
system-managed `index`.

## The renderer contract

Every renderer implements `ComponentOptionInput<T>`: an OnPush standalone
component with two required signal inputs.

```ts
public readonly option = input.required<TOption>();
public readonly commit = input.required<(value: T) => void>();
```

`ComponentSettingsComponent` drives them via `*ngComponentOutlet` over
`option.renderer`, one row per option, tracked by option key.

A renderer **never writes `option().value`** — it reports the edit through
`commit()($event)` and the panel decides what that means: a placement ghost
writes the option directly (the eventual `AddComponentsAction` captures it), a
selected placed component gets a `ChangeOptionAction` (undoable,
dirty-tracking). Bindings are therefore one-way; an external mutation of
`option.value` does not push back into the renderer.

Each renderer owns its whole row — wrapper, label, input — so the panel renders
no per-option chrome and an option is free to be a full-width textarea or a
dialog-opening button. A module-level counter gives each instance a stable id
for `<label [for]>` + `[inputId]`; `lg-select-button` renders a
`div[role=group]` that `for` cannot address, so those rows label by reference
with `[ariaLabelledby]`. Templates render `t(option().label)` under
`*appTranslate`, a schema-checked `TranslationKey`.

The option file imports its renderer **value**; the renderer `import type`s the
option, eliding the back edge at runtime — no cycle, no `forwardRef`.

## Concrete options

| Class                              | Renders as                                                           |
| ---------------------------------- | -------------------------------------------------------------------- |
| `NumberComponentOption`            | `lg-input-number` with buttons; the setter clamps to `min`/`max`     |
| `SelectButtonComponentOption<T>`   | `lg-select-button` row of `{ value, label?, icon? }` toggles         |
| `SelectDropdownComponentOption<T>` | `lg-select` — same data shape, for lists too long for inline buttons |
| `TextInputComponentOption`         | inline `input[lgInputText]`; `maxLength` + `forbiddenChars` per use  |
| `TextAreaComponentOption`          | button opening an `lg-dialog` textarea with draft/save/cancel        |
| `MemoryDataComponentOption`        | button opening `HexEditorComponent` in a dynamic dialog              |

Text writes are sanitized on every set — forbidden characters stripped, then
clamped to `maxLength` — including the constructor's default value.

`MemoryDataComponentOption` is **generic**: it knows nothing about ROM. Its
value is the memory contents as an immutable base64 bit-packed blob (a string,
so clone/paste/undo never alias a buffer), stored trailing-zero-trimmed. The
editing dimensions are not in the blob: the owning component attaches them as
resolver closures via `attachDimensions(() => wordSize, () => wordCount)`, so
any component-specific derivation stays on its side (`RomComponent` passes
`() => 1 << addressSize`) and the link survives every clone path, all of which
run the component factory. The renderer decodes the blob into the dialog and
trims + re-encodes on save. For ROM that same blob is the legacy v0 `s`-slot
value and, via `rom-data.codec.ts`, the engine's ROM `ops` table; the buffer/bit
math is `utils/packed-buffer.ts`.

## Adding a new option kind

1. Add the schema arm to core's `OptionSchema` union and handle it in
   `validateOptionValue`.
2. Create `component-options/<name>/` with the model class extending
   `ComponentOption<T>`: override `renderer`, implement `cloneWithValue`. Add
   the kind to `config-from-meta.ts`'s table. A built-in that must round-trip
   through the legacy v0 format also needs `legacyV0Slots` on its meta (see
   `persistence.md`).
3. Write the renderer as a standalone OnPush `ComponentOptionInput<T>` with
   `option` + `commit` inputs; `import type` the option. Its template owns the
   row and reports edits through `commit()`.
4. Add option-model and renderer specs alongside the source.

`ComponentSettingsComponent` needs no change — it picks the renderer up through
`option.renderer`.
