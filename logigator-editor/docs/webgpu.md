# WebGPU Findings

**Status: WebGPU is disabled** — `RendererService` creates the renderer with
`preference: 'webgl'`. This document records everything learned from the
2026-08 attempt to run the editor on pixi's WebGPU backend, so re-enabling it
later starts from knowledge instead of re-discovery.

**Context:** pixi.js 8.19.0 (latest at the time), Chrome, primary test
hardware AMD Radeon RX 9070 XT (RDNA4) on the D3D12 Dawn backend (hardware
accelerated, not software — verified via `chrome://gpu`). Also reproduced on
Android.

---

## Issue 1 — Aliased dots/wires (no MSAA on canvas targets)

**Symptom:** dots, wires and every pixel-line rasterize inconsistently while
zooming; WebGL stays smooth.

**Root cause:** on WebGPU, MSAA is decided _per render target_ from the
target source's `antialias` flag (`GpuRenderTargetAdaptor.initGpuRenderTarget`
reads `colorTexture.source.antialias`). `getCanvasTexture(canvas)` creates a
`CanvasSource` with `antialias: false` by default, and the renderer-level
`antialias: true` only covers pixi's internal master canvas — which WebGPU
never renders through (only the WebGL `multiView` path rasterizes on the
master canvas and blits).

**Fix attempt A:** `getCanvasTexture(canvas, { antialias: true })` — works
visually, but pixi then resolves the 4× MSAA buffer **directly into the
swapchain texture** every frame, which caused Issue 5 (constant device loss).

**Fix attempt B:** render the scene antialiased into a per-canvas offscreen
`RenderTexture` (MSAA resolves texture-to-texture) and blit it onto the
canvas with a 1:1 sprite draw, so the swapchain never carries MSAA. This is
the standard workaround for resolve-into-swapchain driver bugs. It fixed the
device losses in initial testing but shipped with a regression — **the canvas
stopped reacting to size changes** (likely the offscreen texture / blit
sprite not tracking the `CanvasSource` resize; not diagnosed before the
rollback). The implementation lived in `RendererService._render` /
`_aaTarget` — see git history of `renderer.service.ts` on the `development`
branch, or re-derive: render `container → RenderTexture.create({width,
height, resolution, antialias: true})`, then render a `Sprite` of that
texture with `target: canvas`.

## Issue 2 — Blank minimap / image export / previews

**Symptom:** every extract (minimap, image export, server previews) comes
back fully transparent; the board itself renders fine. Reproduced on Android
and intermittently on desktop.

**Root cause (confirmed):** `GpuTextureSystem.generateCanvas` configures its
readback canvas with `getPreferredCanvasFormat()`, but copies into it with
`copyTextureToTexture`, which requires _matching_ formats. pixi textures
default to `bgra8unorm`; where the platform's preferred canvas format is
`rgba8unorm` (Android, some Linux) the copy fails as a **silent WebGPU
validation error** — no JS exception, no console error, just blank pixels.

**Fix (worked):** patch `generateCanvas` (both `lib/**/*.mjs` and `*.js`) to
configure the canvas with the source texture's own format:

```js
const gpuTexture = renderer.texture.getGpuSource(texture.source);
context.configure({ device, usage, format: gpuTexture.format, alphaMode: "premultiplied" });
commandEncoder.copyTextureToTexture({ texture: gpuTexture, ... }, ...);
```

## Issue 3 — `UniformBufferBatch: ubo batch got too big` + death spiral

**Symptom:** canvas dies with this error; before the patches it appeared
"sometimes" and then persisted for the whole session.

**Mechanics:** WebGPU batches each render pass's per-draw uniforms into one
fixed `Float32Array(65535)` (256 KB, 128-byte alignment ⇒ ~2048 slots).
Every **non-batched** Graphics instance costs one slot per pass
(`GpuGraphicsAdaptor.execute` → `getUniformBindGroup(localUniforms, true)`);
batched draws cost none (`GpuBatchAdaptor` never touches the uniform batch).
A `GraphicsContext` in `batchMode: 'auto'` opts out of batching at ≥400
vertex floats — in this app **only the dot-grid chunk context**
(`GridGraphics`, 1024 rects ≈ 8k floats) is non-batchable; wires are 4 verts
and component bodies ~50, so they batch. Fully zoomed out (`1.2^-12`), grid
chunks alone reach ~1.2k (1440p) to ~2.7k (4K) slots ⇒ legitimate overflow of
the 2048 cap. Upstream: pixijs/pixijs#10903 (open as of 8.19.0).

**The death spiral (confirmed in source):** `uniformBatch.renderEnd()` is the
_only_ place the batch resets, and both `AbstractRenderer.render` and
`RenderGroupSystem.render` call it with **no try/finally**. One exception
mid-render therefore leaves `byteIndex` at its high-water mark, every
subsequent frame starts there and throws too, and each aborted frame leaks an
open command encoder at 60 fps — which is how a single bad frame escalated to
GPU-process death ("A valid external Instance reference no longer exists").

**Fixes (worked):** patch hunks, both module formats:

1. `UboBatch`: `new Float32Array(65535)` → `new Float32Array(524280)` (~16k
   slots / 2 MB; the buffer uploads only used bytes, so cost is idle memory).
2. `RenderGroupSystem.render`: wrap `executeInstructions(...)` in
   `try { ... } finally { if (renderPipes.uniformBatch) renderPipes.uniformBatch.renderEnd(); }`.

**Unresolved residual:** even with both hunks verified live in the served
bundle, UBO overflows still occurred on _viewport resize, Chrome page zoom,
and entering simulation mode_ — situations far below any legitimate 16k-slot
load per the census above. Something un-censused consumes slots (or a code
path still skips the reset). Diagnostics were added but never exercised
before the rollback: a `globalThis.__PIXI_UBO_STATS` gauge
(`{ maxGroups, lastGroups, resets }`, updated in `UboBatch.clear()`) and a
group count in the overflow message (`... (N of 16383 groups)`). **Getting
those numbers is the first step when picking this up again.**

## Issue 4 — Minimap brighter/denser on WebGPU (root-caused, fix still active)

`GlTextureSystem.getPixels` ships its unpremultiply step dead-coded
(`if (false) { unpremultiplyAlpha(pixels); }`), so WebGL readbacks return
premultiplied RGB that `putImageData` misreads as straight alpha — darkening
partially covered pixels to `color·alpha`. WebGPU extracts keep alpha exact,
so the same snapshot reads brighter/denser. The minimap's coverage boost was
calibrated against the darker WebGL output; `BoardSnapshotService` therefore
honors `SnapshotOptions.coverageBoost` **only on WebGL** (this gate is still
in the code and is correct for either backend). If pixi ever enables the
unpremultiply, the boost needs recalibrating.

## Issue 5 — GPU device loss ("A valid external Instance reference no longer exists")

**Symptom:** with canvas MSAA on (fix attempt A of Issue 1), the GPU device
died constantly — reproducibly from _dragging an empty board_. Console shows
the Dawn `InstanceDropped` message and `CONTEXT_LOST_WEBGL` (whole GPU
process gone). pixi v8 has no device-loss recovery, so every canvas stays
dead until reload.

**Findings:** an empty board rules out workload; the trigger is pixi's
per-frame **MSAA resolve directly into the swapchain texture** on AMD D3D12.
The death-spiral (Issue 3) amplified it: after one poisoned frame the app
leaked open command encoders (with MSAA attachments pinned) at 60 fps until
the GPU process collapsed. Fix attempt B of Issue 1 (offscreen resolve)
avoided the losses in initial testing.

A diagnostic device-loss logger proved valuable (removed with the rollback;
trivially re-added): after renderer creation, on WebGPU only —

```ts
(renderer as WebGPURenderer).gpu.device.lost.then((info) =>
  logging.error(
    `WebGPU device lost (reason=${info.reason}, message=${info.message})`,
    'RendererService'
  )
);
```

`reason === 'destroyed'` is teardown/GC noise; anything else is a real loss.

---

## Re-enablement checklist

1. Check newer pixi releases (>8.19.0) for: #10903 (UBO batch), the
   `generateCanvas` format mismatch, exception safety around
   `uniformBatch.renderEnd()`, and `unpremultiplyAlpha` being enabled — each
   upstream fix removes one patch hunk from the list above.
2. Re-apply whatever hunks remain via `yarn patch pixi.js` (edit both the
   `.mjs` and `.js` files under `lib/`; the CJS build prefixes imports, e.g.
   `adapter.DOMAdapter`, `executeInstructions.executeInstructions`).
3. Re-add the device-loss logger before anything else.
4. Run the UBO gauge and capture `__PIXI_UBO_STATS.maxGroups` during panning,
   far zoom-out, window resize, Chrome page zoom and sim-mode entry — resolve
   the Issue 3 residual before trusting any cap.
5. Redo Issue 1 fix attempt B (offscreen MSAA + blit) and fix its resize
   regression: the offscreen texture must track `canvas.clientWidth/Height ×
devicePixelRatio` every frame, exactly like the `CanvasSource` resize in
   `_render` does.
6. Only then flip `preference` back to `'webgpu'` in `renderer.service.ts` —
   dev-server note: the Vite prebundle caches pixi, so after any patch change
   restart the dev server (and `rm -rf .angular/cache` when in doubt) and
   verify in DevTools (search all files) that a marker from the patch, e.g.
   `524280`, is actually served.

## Debug tooling that existed (all removed with the rollback)

- `localStorage['logigator.debug.canvasMsaa'] = 'false'` — bypassed the AA
  path in `RendererService._render` for A/B testing.
- Device-loss logger (snippet above).
- `__PIXI_UBO_STATS` gauge + informative overflow message (patch hunk).
