# Documentation screenshots

Generates the images the in-editor documentation uses
(`src/assets/docs/<lang>/images/`) by driving a real editor: `window.__logigator` (the
[automation API](../../docs/automation.md)) puts the circuit, camera, tool,
simulation, selection, open tabs and inspection windows where a shot needs them,
and Playwright handles what is left — the chrome the API deliberately does not
model (menus, dialogs) and the gestures a shot is _of_ (the scissor marquee).

Every conversion between grid units and CSS px goes through the camera's own
mapping (`camera.toScreen` / `toScreenRect` / `boardRect`) rather than being
recomputed here: the editor owns that transform, and a copy of it out here would
drift the moment the camera changed.

It captures every language the editor ships, one sub-directory per language —
the layout the tracked images use. A shot of the board carries no interface
text and comes out byte-identical in all of them, so only the first, English
capture of it is written and the other languages fall back to that one
(`docs-images.ts` resolves a picture per language, per key).

It only writes files into the directory you name; copying them over the tracked
images is a separate, manual step. Which pictures a language ends up with is
decided by the run, so the editor's registry is generated from the folders
rather than hand-kept — after copying, run:

```bash
node logigator-editor/tools/docs-screenshots/write-registry.mjs
```

That rewrites `src/app/documentation/docs-images.ts` with one import per file
present under `src/assets/docs/<lang>/images/`.

This is a standalone package with its own `yarn.lock` and `.yarnrc.yml` — the
same arrangement as `logigator-backend`. It is not a workspace member, so a root
`yarn install` neither sees nor installs it:

```bash
cd logigator-editor/tools/docs-screenshots && yarn install   # once
```

That also fetches a Chromium build into Playwright's shared browser cache,
unless one is already there.

```bash
yarn start                                            # the editor to shoot
node logigator-editor/tools/docs-screenshots/capture.mjs /tmp/shots
```

Before running, `src/environments/environment.development.ts` needs:

- `automationApi: true` — the script drives the editor through it
- `debugMenu: false` and `showGridBorders: false` — otherwise the Debug menu and
  the red grid borders land in every shot

## Options

The CLI is a [commander](https://github.com/tj/commander.js) program, so
`--help` prints this list:

```
<out-dir>        required, first positional
--only <shots>   capture just these shots (comma separated)
--lang <codes>   languages to capture (default en,de,fr,es)
--base <url>     editor to drive (default http://localhost:4200/editor)
--headed         run the browser headed
```

`--lang` narrows a run to the languages you are working on. Keep `en` in it
whenever you can: it is the baseline the others are compared against, and
without it every capture is written, including the ones that only duplicate an
English picture.

`--base` also takes an HTTPS development instance (`https://logigator.test/editor`):
certificate errors are ignored, so a self-signed local certificate needs no setup.

## Progress output

Shots are run as a [listr2](https://listr2.kilic.dev) task list, grouped by
language — one line each,
with the elapsed time when it settles and, underneath the running one, the step
it is on (`opening the editor`, `loading half-adder`, `settling the
simulation`). Those come from `Editor.report`, which the calls that can take
seconds announce themselves through; a shot that stalls therefore says what it
is waiting on. A failing shot is marked and the run carries on, and the exit
code is 1 if any shot failed. Piped or redirected output drops to one line per
event, so a container log stays readable.

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

Every shot gets its own browser context, so IndexedDB drafts, the
custom-component library and preferences never leak between shots. Before the
first paint each context pins the theme, language and preferences, and silences
the first-run nudge and the "What's new" popup — nothing depends on run order.

Nothing in a shot spells an interface label out. The ones that open a menu,
switch a dialog tab or click a button name it by translation key, which
`lib/i18n.mjs` resolves out of the editor's own `src/i18n/<lang>.ts` (Node
strips the types, so the locale files load as they are). A reworded label
therefore moves the shot with it, and a key that no longer exists fails the shot
by name instead of timing out on a missing element.

Clips come from element boxes rather than from markup added for the tool:
`unionClip` takes the union of any set of selectors (the five tool buttons, the
title bar plus the toolbar), and `gridClip` / `contentClip` convert grid
rectangles through the camera's own mapping.

`intro-banner.png` is the one doc image not produced here — it is a designed
banner, not a capture of the editor.

Shots run against the automation API this branch ships. `Editor.open()` probes
one of its newer calls, so an editor built before them fails with that message
rather than a `TypeError` inside whichever shot ran first.

## Animated shots

The animated doc images are step-throughs, not motion capture: two settled
states of the same scene, a tick or a switch apart. A shot builds those by
capturing frames into memory with `editor.snap()` and returning them; the runner
encodes a GIF (`gifenc` + `pngjs`) instead of a PNG:

```js
const frames = [await ed.snap({ clip })];
await ed.setInput(lever.id, true);
await ed.runUntilSettled();
frames.push(await ed.snap({ clip }));
return { frames }; // → <name>.gif, 1200 ms per frame
```

Every frame must use the same clip; `delay` overrides the frame time. The shots
that just flip a switch share `switchedFrames()`, which drives the engine to a
settled state on either side of the flip.

## Editing the circuits

`circuits/*.json` are ordinary editor exports. To change a scene, open its file
in the editor (**File → Open → From File**), redraw it, and export it back over
the same name (**File → Export to file**) — do not hand-edit the coordinates,
they are delta-encoded.

A v1 file embeds a frozen copy of every custom component in its circuit, so
loading one is also how the custom-component shots get their masters:
`library.edit` restores the embedded copy into the browser library and opens it
in its own tab, which is also what fills the palette's _User Components_.

## Resolution

Everything is captured at `deviceScaleFactor: 2` — "200% zoom", so both the DOM
chrome and the PixiJS canvas (whose resolution follows `devicePixelRatio`) come
out at 2×. Playwright clips are always CSS px; the scale is applied by the
renderer. Close-up board shots pin the camera to `BOARD_ZOOM` (`1.2³`, a step on
the editor's zoom ladder) so a gate is the same size on every page; the two
animated shots go further up the ladder, because there the circuit shares the
frame with chrome that sets its own size (the run controls, the ROM inspector).

Framing is per shot: `context.viewport` sizes the window, and shots whose
subject spans it (the bars, the run controls) use `NARROW_VIEWPORT` — the tool
bar wraps to a second row once its buttons no longer fit, which binds before the
compact breakpoint (`max-width: 64rem`) does. Where it wraps follows the
language, because the run controls the bar ends in are labelled: 1061 CSS px in
English, 1073 in Spanish, 1078 in German, 1109 in French. `NARROW_VIEWPORT` is
the widest of those plus headroom and is the same for every language, so the
bars come out framed alike. A floating window is clamped to the board it hangs
over, so a short viewport is also what makes the inspection window short.

That framing is measured, not assumed, so most of it follows a longer language
on its own. The one thing that does not is the tool bar: its buttons are
labelled by tooltip, but the bar is laid out `flex-wrap`, so a viewport that
fits the English bar can silently fold another language's in two. The shots that
frame the chrome call `requireSingleRowToolBar()` and fail rather than produce a
picture a row taller; the fix is a wider `NARROW_VIEWPORT`.

Captures repeat to within a handful of antialiased border pixels.

## Encoding

Chromium hands screenshots back as truecolour, while the editor draws from a
flat palette: a full-window shot uses a few thousand distinct colours, nearly
all of them antialiasing between a much smaller set. Every PNG is therefore
written indexed (`sharp`, libimagequant at quality 100), which halves it and
holds the picture to a per-channel mean difference around 0.03.

A GIF leans on the same flatness twice more, because its frames are two settled
states of one scene: a single palette is quantized across all of them and
written as the global colour table, and every frame after the first keeps only
the pixels whose colour index changed, writing the rest as a transparent index
over an undisposed predecessor.

Both encoders are deterministic, so re-capturing an unchanged shot produces
identical bytes and leaves the tracked image alone.

## Cloud shots

`account-menu`, `open-cloud`, `upload-to-cloud` and `share-component` run
against `lib/mock-api.mjs` — a fixed set of projects, components, dates and one
share link, served by intercepting `/api/**` and setting the `isAuthenticated`
cookie. A live account would put a drifting project list and a moving "Last
edited" date into the docs. The share link's host is whatever `--base` points at.

## Running in a container

Point the script at a browser and give it software rendering:

```bash
LOGIGATOR_SHOTS_BROWSER=/usr/local/bin/pw-chromium \
LOGIGATOR_SHOTS_BROWSER_ARGS="--no-sandbox --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader" \
node logigator-editor/tools/docs-screenshots/capture.mjs /tmp/shots
```

Software-rendered canvas output can differ subtly from a GPU machine's, so
generate the images from one consistent environment.
