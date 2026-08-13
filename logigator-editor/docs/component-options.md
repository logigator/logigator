# Component Options

A `ComponentOption<T>` is an observable wrapper around a single configurable value on a circuit component (e.g. rotation, number of inputs). Each option also owns the Angular component that renders it in the side panel — `ComponentSettingsComponent` is a thin loop that asks each option what to render and instantiates it via `*ngComponentOutlet`.

## Directory Layout

```
src/app/components/component-options/
├── number/
│   ├── number.component-option.ts           # option model
│   ├── number-option-input.component.ts     # renderer
│   └── number-option-input.component.html
├── select-button/
│   ├── select-button.component-option.ts
│   ├── select-button-option-input.component.ts
│   └── select-button-option-input.component.html
├── select-dropdown/
│   ├── select-dropdown.component-option.ts
│   ├── select-dropdown-option-input.component.ts
│   └── select-dropdown-option-input.component.html
├── text-area/
│   ├── text-area.component-option.ts          # multi-line text (dialog editor)
│   ├── text-area-option-input.component.ts
│   └── text-area-option-input.component.html
└── text-input/
    ├── text-input.component-option.ts         # short single-line text
    ├── text-input-option-input.component.ts
    └── text-input-option-input.component.html
```

One folder per option kind. The option model class and its renderer sit side by side.

---

## Type Hierarchy

```
ComponentOption<T> (abstract)
├── NumberComponentOption
├── SelectButtonComponentOption<T>
├── SelectDropdownComponentOption<T>
├── TextAreaComponentOption
├── TextInputComponentOption
└── MemoryDataComponentOption
```

A component's rotation is **not** an option: `direction` is first-class `Component` state (serialized as its own field), and the settings panel renders a fixed direction row above the option rows for every component (see `ui.md`).

`MemoryDataComponentOption` holds a word-addressed memory's contents as an immutable base64 bit-packed blob (string value, so clone/paste/undo never alias a buffer). It is **generic** — it knows nothing about ROM. Its renderer is the adapter between that storage and the generic `HexEditorComponent` (`ui/hex-editor/`), which takes a plain `Uint8Array` + word width + word count. `HexEditorComponent` is a **plain, self-contained component (no dialog wrapper)** — `inputs: data/wordSize/wordCount`, `outputs: saved (Uint8Array) / dismissed`; the renderer opens it in a PrimeNG `DynamicDialog` via `DialogService.open(HexEditorComponent, { inputValues, … })`, wiring its outputs through `ref.onChildComponentLoaded` (commit + trim on `saved`, close on either). The editing dimensions arrive as **resolver closures** the owning component attaches via `attachDimensions(() => wordSize, () => wordCount)`; this is where any component-specific derivation lives (e.g. `RomComponent` passes `() => 1 << addressSize` from its constructor, so the link survives every clone path, all of which run the component factory). On open the renderer decodes the blob and passes the dimensions as input values; on save it trims trailing zeros and re-encodes. For ROM the same blob is the legacy v0 `s`-slot value and (via `rom-data.codec.ts`'s `encodeRomOps`) the engine ROM `ops` table. The generic buffer/bit math lives in `utils/packed-buffer.ts`; `rom-data.codec.ts` only adds ROM semantics on top.

---

## Cloning and cross-cutting flags

Options are cloned on every deserialize/placement path (`ComponentOption.clone(initialValue?)` returns the same concrete subtype via a polymorphic `this` return). Cloning is a **template method**: the base `clone` calls the subclass's `protected cloneWithValue(initialValue?)` and then copies cross-cutting flags so they survive the clone. Concrete subclasses implement `cloneWithValue`, never `clone`.

The one cross-cutting flag today is `inspectorHidden` (default `false`). When `true`, the option still round-trips through the wire format but is omitted from the rendered settings form — `ComponentSettingsComponent.configEntries` filters it out:

```ts
public readonly configEntries = computed(() =>
    Object.entries(this.config()).filter(([, option]) => !option.inspectorHidden)
);
```

Set it fluently in a config: `new NumberComponentOption(...).hideFromInspector()`. Used for a plug's system-managed `index` option, which is driven by the (future) Ports panel rather than typed by the user.

---

## The `renderer` field

Every concrete `ComponentOption` subclass exposes:

```ts
public readonly renderer: Type<unknown>;
```

`renderer` points at the Angular component class that knows how to render this option. `ComponentSettingsComponent` reads it through `*ngComponentOutlet`:

```html
<form class="flex flex-col gap-2">
  @for (entry of configEntries(); track entry[0]) {
  <ng-container
    *ngComponentOutlet="entry[1].renderer; inputs: { option: entry[1] }"
  ></ng-container>
  }
</form>
```

`ComponentSettingsComponent` receives the options as a `Record<string, ComponentOption>` and exposes `configEntries` (a `computed` over `Object.entries(this.config())`, filtered to drop `inspectorHidden` options — see [Cloning and cross-cutting flags](#cloning-and-cross-cutting-flags)) for iteration. `track entry[0]` keys on the option name string, so swapping an option for a different one at the same key correctly tears down and re-creates the renderer.

The base class types this as `Type<unknown>` because `ngComponentOutlet`'s `inputs` map is `Record<string, unknown>` — narrowing further does not buy any extra type safety.

## Import-cycle convention

The option file imports its renderer **value** (to expose via `renderer`); the renderer imports the option **type** (for `input.required<…>()`). Break the cycle with `import type` on the renderer side:

```ts
// number-option-input.component.ts
import type { NumberComponentOption } from './number.component-option';
```

`import type` is elided at runtime, so the only runtime edge is option → renderer. No cycle, no `forwardRef` needed.

---

## The binding contract

Every renderer is an OnPush standalone component with a required signal input:

```ts
public readonly option = input.required<TOption>();
```

Two-way binding goes through the existing setter: the template reads `option().value` and writes back through `(ngModelChange)="option().value = $event"`. The setter keeps firing `onChange$`, so downstream subscribers (the live `Component` instance subscribed during construction) react unchanged.

External mutations of `option.value` do **not** push to the renderer — the template uses `[ngModel]` (one-way) + `(ngModelChange)`. This matches the pre-refactor behavior and is fine because today nothing outside the renderer mutates option values.

### Row layout, label association

Each renderer owns its entire row — the wrapper `<div class="flex gap-4 items-center justify-between">`, the `<label>`, and the input. The parent renders no per-option chrome, so an option is free to break the convention (full-width textarea, no label, etc.) if it ever needs to.

Each renderer generates a stable `inputId` once per instance via a module-level counter and uses it for both `<label [for]>` and the PrimeNG input's `[inputId]`. Don't wrap the input in the `<label>` — PrimeNG inputs render multiple spans around the real `<input>`, so click-on-label associations are unreliable; explicit `for`/`inputId` is the safe path.

### Translation

Each renderer's template starts with `*appTranslate="let t"` and uses `t(option().label)` for the label text (`label` is typed `TranslationKey`, so the key is schema-checked). Keeping the structural directive in each renderer template is cheaper than injecting `TranslationService` and works regardless of which renderer is mounted.

---

## Concrete options

### `NumberComponentOption`

Numeric value with `min` and `max` bounds. The value setter clamps automatically. Renders as `<p-inputNumber>` with `[showButtons]`, `[min]`, `[max]`, `size="small"`.

### `SelectButtonComponentOption<T>`

Categorical selection rendered as a row of toggle buttons (`<p-selectButton>`). Each option entry is `{ value, label?, icon? }`. Used by `DirectionComponentOption` to expose the four compass arrows.

### `SelectDropdownComponentOption<T>`

Same data shape as the button variant, rendered as `<p-select>` (a dropdown). Used when the option list is too long for inline buttons.

The button and dropdown templates share an `#itemTemplate` shape (icon + label `<div>`). The duplication is small enough that we tolerate it rather than introduce a shared partial.

### `DirectionComponentOption`

A no-arg preset: `SelectButtonComponentOption<Direction>` pre-loaded with the four cardinal arrow icons. Inherits its renderer from `SelectButtonComponentOption`.

### `TextAreaComponentOption`

Multi-line string. Renders as a "edit" button that opens a `<p-dialog>` with a `<textarea>`; the dialog has draft/save/cancel semantics so edits commit only on save. Constrained by `maxLength`. Used by the TEXT component.

### `TextInputComponentOption`

Short single-line string, rendered as an inline `<input pInputText>` row — the single-line counterpart to `TextAreaComponentOption`. Generic: constraints are supplied per-use via config (`maxLength`, and `forbiddenChars` for characters stripped on every write), not baked in. The INPUT/OUTPUT plug port labels configure `maxLength: 5` + `forbiddenChars: /,/g` to fit the backend's comma-joined label column.

---

## Where an option's constraints live

Each option class is the **renderer-bearing half** of a pure `OptionSchema` in
`@logigator/core` (`catalog/option-schema.ts`) — one schema kind per class:
`number`, `select-button`, `select-dropdown`, `text`, `textarea`, `memory`. The
schema carries the constraints (range, allowed values, max length, forbidden
characters as a string, default); the class adds the Angular `renderer`, the
live value and the clamping setters.

`configFromMeta` (`components/config-from-meta.ts`) owns the one kind → class
table, so a built-in's config never instantiates an option itself. The split is
what lets the server reject an illegal option value with
`validateOptionValue(schema, value)` — the same check the automation write path
runs — without importing anything Angular.

---

## Adding a new option kind

1. Add the schema arm to core's `OptionSchema` union and handle it in
   `validateOptionValue`.
2. Create a folder under `component-options/<name>/`.
3. Write the option model class extending `ComponentOption<T>` (or `SelectButtonComponentOption<T>` / `SelectDropdownComponentOption<T>` if a select fits). Override `renderer` to point at your renderer component and implement `protected cloneWithValue(initialValue?)` (not `clone` — the base provides that). Add the kind to `config-from-meta.ts`'s table. A built-in that must round-trip through the legacy v0 server/file format also adds a `legacyV0Slots` entry on its meta (see `persistence.md`).
4. Write the renderer as a standalone OnPush component with `option = input.required<YourComponentOption>()`. `import type` the option to avoid the value-import cycle.
5. The renderer template owns the row (wrapper + label + input) and uses `[ngModel]` / `(ngModelChange)` to write through the option's setter.
6. Add option-model and (at minimum) renderer specs alongside the source files.

`ComponentSettingsComponent` does not need to change — it picks up the new option automatically through `option.renderer`.
