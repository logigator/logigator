# Documentation screenshots

Generates the images the in-editor documentation uses
(`src/assets/docs/<lang>/images/`) by driving a real editor:
`window.__logigator` (the [automation API](../../docs/automation.md)) puts the
circuit, camera, tool, simulation, selection, tabs and inspection windows where
a shot needs them, and Playwright handles the rest — the chrome the API
deliberately does not model (menus, dialogs) and the gestures a shot is _of_
(the scissor marquee).

Every language gets its own sub-directory. A board shot carries no interface
text and comes out byte-identical in all of them, so only the English capture of
it is written and the other languages fall back to that one.

## Setup and running

A standalone package with its own `yarn.lock` and `.yarnrc.yml`, so a root
`yarn install` neither sees nor installs it:

```bash
cd logigator-editor/tools/docs-screenshots && yarn install   # once
```

That also fetches a Chromium build into Playwright's shared browser cache.

```bash
yarn start:editor:prod --define "AUTOMATION_API=true"   # the editor to shoot
node logigator-editor/tools/docs-screenshots/capture.mjs /tmp/shots
```

Shoot against the **production** configuration, not `yarn start:editor`: every
developer switch in `src/define.d.ts` defaults to off there, so the Debug menu
and the red grid borders stay out of every shot — and so does any switch added
later. `AUTOMATION_API` is the one that has to come back on, because the script
drives the editor through it; forgetting it is safe, since `Editor.open()`
probes for the facade and aborts rather than producing wrong shots. No source
edit is needed for any of this.

The script only writes into the directory you name. After copying the images
over the tracked ones, regenerate the editor's registry:

```bash
node logigator-editor/tools/docs-screenshots/write-registry.mjs
```

### Options

```
<out-dir>        required, first positional
--only <shots>   capture just these shots (comma separated)
--lang <codes>   languages to capture (default en,de,fr,es)
--base <url>     editor to drive (default http://localhost:4200/editor)
--headed         run the browser headed
```

Keep `en` in `--lang` whenever you can: it is the baseline the others are
compared against, and without it every capture is written, including the ones
that only duplicate an English picture. `--base` also takes an HTTPS development
instance — certificate errors are ignored.

Shots run as a [listr2](https://listr2.kilic.dev) task list grouped by language,
each line naming the step it is on. A failing shot is marked and the run carries
on; the exit code is 1 if any failed. Piped output drops to one line per event.

## What a shot is

`shots/index.mjs` is the registry. Each entry names the image it produces and a
`run(editor)` that stages the editor and returns what to capture:

```js
{
  name: 'negated-gate',
  async run(ed) {
    await ed.load('negated-gate');
    return { clip: await ed.contentClip({ pad: 1.5 }) };
  }
}
```

Every shot gets its own browser context with the theme, language and preferences
pinned before the first paint, so nothing depends on run order.

Nothing in a shot spells an interface label out: menus, dialog tabs and buttons
are named by translation key, which `lib/i18n.mjs` resolves out of the editor's
own `src/i18n/<lang>.ts`. A reworded label moves the shot with it, and a key
that no longer exists fails by name instead of timing out on a missing element.
Clips likewise come from element boxes rather than from markup added for the
tool, and every grid ↔ CSS-px conversion goes through the camera's own mapping.

`intro-banner.png` is the one doc image not produced here — a designed banner,
not a capture.

### Animated shots

The animated images are step-throughs, not motion capture: two settled states of
one scene, a tick or a switch apart. A shot captures frames into memory with
`editor.snap()` and returns them; the runner encodes a GIF instead of a PNG:

```js
const frames = [await ed.snap({ clip })];
await ed.setInput(lever.id, true);
await ed.runUntilSettled();
frames.push(await ed.snap({ clip }));
return { frames }; // → <name>.gif, 1200 ms per frame
```

Every frame must use the same clip; `delay` overrides the frame time. The shots
that just flip a switch share `switchedFrames()`.

### Cloud shots

`account-menu`, `open-cloud`, `upload-to-cloud` and `share-component` run
against `lib/mock-api.mjs` — fixed projects, components, dates and one share
link, served by intercepting `/api/**` and setting the `isAuthenticated` cookie.
The share link's host is whatever `--base` points at.

## Editing the circuits

`circuits/*.json` are ordinary editor exports. To change a scene, open its file
in the editor (**File → Open → From File**), redraw it, and export it back over
the same name (**File → Export to file**) — do not hand-edit the coordinates,
they are delta-encoded.

A v1 file embeds a frozen copy of every custom component in its circuit, which
is also how the custom-component shots get their masters: `library.edit`
restores the embedded copy into the browser library and opens it in its own tab,
filling the palette's _User Components_.

## Framing and encoding

Everything is captured at `deviceScaleFactor: 2` — "200% zoom", so both the DOM
chrome and the PixiJS canvas come out at 2×. Playwright clips are always CSS px;
the renderer applies the scale. Close-up board shots pin the camera to
`BOARD_ZOOM` so a gate is the same size on every page; a shot sharing its frame
with chrome that sets its own size goes further up the zoom ladder.

`context.viewport` sizes the window per shot, and shots whose subject spans it
use `NARROW_VIEWPORT`. Framing is measured rather than assumed, so most of it
follows a longer language on its own. The exception is the tool bar: it is laid
out `flex-wrap`, so a viewport fitting the English bar can silently fold another
language's in two — the shots that frame the chrome call
`requireSingleRowToolBar()` and fail instead, and the fix is a wider
`NARROW_VIEWPORT`.

PNGs are written indexed and GIFs share one global palette with inter-frame
diffing (`lib/png.mjs`, `lib/gif.mjs`). Both encoders are deterministic, so
re-capturing an unchanged shot produces identical bytes and leaves the tracked
image alone. Captures repeat to within a handful of antialiased border pixels.

## Running in a container

Point the script at a browser and give it software rendering:

```bash
LOGIGATOR_SHOTS_BROWSER=/usr/local/bin/pw-chromium \
LOGIGATOR_SHOTS_BROWSER_ARGS="--no-sandbox --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader" \
node logigator-editor/tools/docs-screenshots/capture.mjs /tmp/shots
```

Software-rendered canvas output can differ subtly from a GPU machine's, so
generate the images from one consistent environment.
