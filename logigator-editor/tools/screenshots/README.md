# Screenshots

Generates the images the product shows, by driving a real editor: `window.__logigator`
(the [automation API](../../docs/automation.md)) puts the circuit, camera, tool,
simulation, selection, tabs and inspection windows where a shot needs them, and
Playwright handles the rest — the chrome the API deliberately does not model
(menus, dialogs) and the gestures a shot is _of_ (the scissor marquee).

One run is one **target**, and a target owns what is specific to the images it
produces: its shot list, the colour schemes it runs, the window it frames, where
a capture lands and what it is called. Two exist:

- **`docs`** — the in-editor documentation's screenshots
  (`logigator-docs/src/pages/<lang>/images/`), dark and single-themed. Every
  language gets its own sub-directory; a board shot carries no interface text
  and comes out byte-identical in all of them, so only the English capture of it
  is written and the others fall back to that one.
- **`web`** — the features page's tour figures
  (`logigator-web/src/assets/tour/`), four languages × two colour schemes,
  English still the fallback — per scheme now.

**Every image is lossless WebP**, animated for the step-throughs. It is the
tool's only output format; `lib/webp.mjs` is the only encoder in it.

## Setup and running

A standalone package with its own `yarn.lock` and `.yarnrc.yml`, so a root
`yarn install` neither sees nor installs it:

```bash
cd logigator-editor/tools/screenshots && yarn install   # once
```

That also fetches a Chromium build into Playwright's shared browser cache.

```bash
yarn start:editor:prod --define "AUTOMATION_API=true"   # the editor to shoot
node logigator-editor/tools/screenshots/run.mjs docs logigator-docs
```

The second argument is **the consuming package's own root**, not a scratch
directory: the captures land where the app imports them from and the run then
rewrites that package's import map in place, so the trees the images are shot
into are the trees that are committed. There is no copying-over step and no
out-dir to keep — a run against `/tmp` produces a complete set of pictures
nothing references. `docs` writes `logigator-docs/`, `web` writes
`logigator-web/`.

Shoot against the **production** configuration, not `yarn start:editor`: every
developer switch in `src/define.d.ts` defaults to off there, so the Debug menu
and the red grid borders stay out of every shot — and so does any switch added
later. `AUTOMATION_API` is the one that has to come back on, because the script
drives the editor through it; forgetting it is safe, since `Editor.open()`
probes for the facade and aborts rather than producing wrong shots. No source
edit is needed for any of this.

Nothing outside the directory you name is touched.

### Options

```
<target>          required, first positional: a folder under targets/
<out-dir>         required, second positional: the tree the captures land in
--only <shots>    capture just these shots (comma separated)
--lang <codes>    languages to capture (default: every language the origin speaks)
--theme <schemes> colour schemes to capture (default: what the target declares)
--base <url>      where the editor is served (default: what the target declares)
--no-baseline     write every pass instead of falling back to the first one
--headed          run the browser headed
```

Keep `en` in `--lang` whenever you can: it is the baseline each colour scheme is
compared against, and without it every capture is written, including the ones
that only duplicate an English picture. `--base` also takes an HTTPS development
instance — certificate errors are ignored.

Shots run as a [listr2](https://listr2.kilic.dev) task list grouped by colour
scheme and language, each line naming the step it is on. A failing shot is marked
and the run carries on; the exit code is 1 if any failed, and no registry is
written. Piped output drops to one line per event.

### What each target needs running

`docs` shoots the editor by itself. `web` shoots the site, whose features page
sits beside the editor at the same origin, so it wants the dev compose stack
(`docker compose up proxy editor web`) and an editor built with the automation
API on. The `web` target's media arrives with the features page itself — its
shot list is empty until then, and a run says so rather than writing an empty
registry.

## What a shot is

`targets/<name>/shots.mjs` is the shot list. Each entry names the image it
produces and a `run(editor)` that stages the editor and returns what to capture:

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
pinned before the first paint, so nothing depends on run order. The language and
the colour scheme travel as the origin-wide `preferences` cookie — the one
mechanism every app on the origin reads them from, whose codec core owns and
`lib/origin.mjs` loads rather than restates.

Nothing in a shot spells an interface label out: menus, dialog tabs and buttons
are named by translation key, which `lib/i18n.mjs` resolves out of the editor's
own `src/i18n/<lang>.ts`. A reworded label moves the shot with it, and a key
that no longer exists fails by name instead of timing out on a missing element.
Clips likewise come from element boxes rather than from markup added for the
tool, and every grid ↔ CSS-px conversion goes through the camera's own mapping.

`intro-banner.webp` is the one doc image not produced here — a designed banner,
not a capture.

### Animated shots

The animated images are step-throughs, not motion capture: two settled states of
one scene, a tick or a switch apart. A shot captures frames into memory with
`editor.snap()` and returns them; the runner encodes an animation instead of a
still:

```js
const frames = [await ed.snap({ clip })];
await ed.setInput(lever.id, true);
await ed.runUntilSettled();
frames.push(await ed.snap({ clip }));
return { frames }; // → one animated WebP, 1200 ms per frame
```

Every frame must use the same clip; `delay` overrides the frame time. The shots
that just flip a switch share `switchedFrames()`.

### Cloud shots

`account-menu`, `open-cloud`, `upload-to-cloud` and `share-component` run
against `lib/cloud-api.mjs` — fixed projects, components, dates and one share
link, served by intercepting `/api/**` and setting the `isAuthenticated` cookie.
The share link's host is whatever `--base` points at.

## Editing the circuits

`circuits/*.json` are ordinary editor exports, shared by every target. To change
a scene,
open its file in the editor (**File → Open → From File**), redraw it, and export
it back over the same name (**File → Export to file**) — do not hand-edit the
coordinates, they are delta-encoded.

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

Stills and step-throughs alike are **lossless WebP** through sharp. Lossless,
because the editor draws anti-aliased text and hairlines over flat ground, which
is the case lossy WebP handles worst — measured on the tracked captures, the
whole tree came out 1.89× smaller than the quantized PNGs and GIFs it replaced.
libwebp is deterministic, so re-capturing an unchanged shot produces identical
bytes and leaves the tracked image alone. Captures themselves repeat to within a
handful of antialiased border pixels.

## Running in a container

Point the script at a browser and give it software rendering:

```bash
LOGIGATOR_SHOTS_BROWSER=/usr/local/bin/pw-chromium \
LOGIGATOR_SHOTS_BROWSER_ARGS="--no-sandbox --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader" \
node logigator-editor/tools/screenshots/run.mjs docs logigator-docs
```

Software-rendered canvas output can differ subtly from a GPU machine's, so
generate the images from one consistent environment.
