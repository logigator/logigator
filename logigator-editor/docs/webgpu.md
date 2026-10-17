# WebGPU

**WebGPU is disabled**: `RendererService` creates the renderer with
`preference: 'webgl'`. Below is what pixi 8.19's WebGPU backend needs before
that can flip. None of the patches are applied — there is no `.yarn/patches`.
Findings are from pixi.js 8.19.0 on Chrome, mostly on an AMD Radeon RX 9070 XT
(RDNA4, D3D12 Dawn), some also on Android.

## Issue 1 — No MSAA on canvas targets

WebGPU decides MSAA **per render target** from the target source's `antialias`
flag (`GpuRenderTargetAdaptor.initGpuRenderTarget`). `getCanvasTexture(canvas)`
builds a `CanvasSource` with `antialias: false`, and the renderer-level
`antialias: true` covers only pixi's internal master canvas, which WebGPU never
renders through. Dots, wires and pixel-lines rasterize inconsistently on zoom.

Passing `{ antialias: true }` to `getCanvasTexture` makes pixi resolve the 4×
MSAA buffer straight into the swapchain texture every frame, which is Issue 5.
The workable shape is an offscreen resolve: render into a per-canvas
`RenderTexture.create({ …, antialias: true })` and blit it onto the canvas with
a 1:1 sprite draw, so the swapchain never carries MSAA. That removed the device
losses but shipped an undiagnosed regression — **the canvas stopped reacting to
size changes**; the offscreen texture has to track `canvas.clientWidth/Height ×
devicePixelRatio` every frame.

## Issue 2 — Blank minimap / image export / previews

Every extract comes back fully transparent while the board renders fine.
`GpuTextureSystem.generateCanvas` configures its readback canvas with
`getPreferredCanvasFormat()` but copies into it with `copyTextureToTexture`,
which requires _matching_ formats. Pixi textures default to `bgra8unorm`; where
the preferred canvas format is `rgba8unorm` (Android, some Linux) the copy
fails as a **silent WebGPU validation error** — no exception, no console
message, just blank pixels. Fix: configure the canvas with the source texture's
own format (`renderer.texture.getGpuSource(texture.source).format`).

## Issue 3 — `UniformBufferBatch: ubo batch got too big`

A render pass batches its per-draw uniforms into one fixed
`Float32Array(65535)` (256 KB, 128-byte alignment ⇒ ~2048 slots). Every
**non-batched** Graphics instance costs a slot per pass; batched draws cost
none. `batchMode: 'auto'` opts out at ≥400 vertex floats, so only the dot-grid
chunk context qualifies here (`GridGraphics`, 1024 rects ≈ 8k floats — wires are
4 verts, bodies ~50). Fully zoomed out, grid chunks alone reach ~1.2k (1440p) to
~2.7k (4K) slots: a legitimate overflow. Upstream: pixijs/pixijs#10903, open as
of 8.19.0.

**The overflow is self-perpetuating.** `uniformBatch.renderEnd()` is the only
reset, and both `AbstractRenderer.render` and `RenderGroupSystem.render` call it
with no `try/finally`. One exception mid-render leaves `byteIndex` at its
high-water mark, so every later frame starts there and throws too, leaking an
open command encoder at 60 fps until the GPU process dies. Two hunks address
that: grow `UboBatch`'s array to `Float32Array(524280)` (~16k slots / 2 MB; only
used bytes upload) and wrap `executeInstructions(...)` in a `finally` that calls
`renderPipes.uniformBatch?.renderEnd()`.

**Unresolved residual:** with both hunks verified live in the served bundle,
overflows still hit on viewport resize, Chrome page zoom and entering
simulation — far below any legitimate 16k-slot load. Something un-censused
consumes slots, or a path still skips the reset. Instrument before trusting any
cap: a `globalThis.__PIXI_UBO_STATS` gauge (`{ maxGroups, lastGroups, resets }`
updated in `UboBatch.clear()`) plus the group count in the overflow message.

## Issue 4 — WebGL extracts are darker than WebGPU's

`GlTextureSystem.getPixels` ships its unpremultiply step dead-coded
(`if (false) { unpremultiplyAlpha(pixels); }`), so WebGL readbacks return
premultiplied RGB that `putImageData` reads as straight alpha, darkening
partially covered pixels to `color·alpha`. WebGPU keeps alpha exact and reads
brighter. This is live on either backend: the minimap's coverage boost was
calibrated against the darker WebGL output, so `BoardSnapshotService` honors
`SnapshotOptions.coverageBoost` **only on WebGL**. If pixi enables the
unpremultiply, the boost needs recalibrating.

## Issue 5 — GPU device loss

Pixi's per-frame **MSAA resolve directly into the swapchain texture** kills the
GPU device on AMD/D3D12 — reproducibly from dragging an _empty_ board, so
workload is not the trigger. Dawn reports `InstanceDropped` and
`CONTEXT_LOST_WEBGL`; pixi v8 has no device-loss recovery, so every canvas stays
dead until reload. Issue 3 amplifies it: one poisoned frame leaks command
encoders with MSAA attachments pinned. Issue 1's offscreen resolve avoids it.

Re-add a device-loss logger first thing, on WebGPU only
(`gpu.device.lost.then(…)`). `reason === 'destroyed'` is teardown noise;
anything else is a real loss.

## Re-enablement checklist

1. Check pixi > 8.19.0 for #10903, the `generateCanvas` format mismatch,
   exception safety around `uniformBatch.renderEnd()`, and `unpremultiplyAlpha`
   being enabled — each upstream fix drops one hunk.
2. Apply the remaining hunks via `yarn patch pixi.js`, editing both the `.mjs`
   and `.js` files under `lib/` (the CJS build prefixes imports, e.g.
   `executeInstructions.executeInstructions`).
3. Re-add the device-loss logger.
4. Run the UBO gauge and capture `maxGroups` during panning, far zoom-out,
   window resize, Chrome page zoom and sim-mode entry; resolve Issue 3's
   residual before trusting any cap.
5. Redo the offscreen MSAA + blit and make its texture track the canvas size.
6. Only then set `preference: 'webgpu'`. The dev server prebundles pixi, so
   restart it after any patch change (`rm -rf .angular/cache` when in doubt) and
   confirm in DevTools that a marker such as `524280` is actually served.
