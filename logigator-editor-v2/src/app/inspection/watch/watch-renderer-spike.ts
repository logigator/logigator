/* eslint-disable no-console -- debug-menu validation harness, console is the output */
import { autoDetectRenderer, Container, Renderer, RendererType } from 'pixi.js';
import { environment } from '../../../environments/environment';
import { Component } from '../../components/component';
import { ComponentProviderService } from '../../components/component-provider.service';
import { BuiltInComponentType } from '../../components/component-type.enum';
import { buildProject } from '../../persistence/circuit-builder';
import { Project } from '../../project/project';
import { getStaticDI } from '../../utils/get-di';
import { ThemingService } from '../../theming/theming.service';
import { Wire } from '../../wires/wire';
import { WireDirection } from '../../wires/wire-direction.enum';

/**
 * Phase-2 validation spike for the shared watch renderer (see
 * `plans/custom-component-inspection.md`): renders a headless {@link Project}
 * through a second renderer onto two DOM canvases, to prove the CPU-side
 * resources shared with the main renderer (GraphicsContext caches, the runtime
 * BitmapText atlas, theme-keyed re-tint) upload cleanly on a renderer of their
 * own. Reachable from the Debug menu; superseded by `WatchRendererService`.
 */

const OVERLAY_ID = 'watch-renderer-spike-overlay';
const VIEW_WIDTH = 360;
const VIEW_HEIGHT = 240;

interface SpikeState {
  renderer: Renderer;
  project: Project;
  wires: Wire[];
  components: Component[];
  canvases: HTMLCanvasElement[];
  powered: boolean;
}

export type SpikePreference = 'webgpu' | 'webgl' | 'canvas';

/** Opens (or replaces) the spike overlay. Returns the backend it landed on. */
export async function runWatchRendererSpike(
  preference?: SpikePreference
): Promise<string> {
  document.getElementById(OVERLAY_ID)?.remove();

  const provider = getStaticDI(ComponentProviderService);
  const theming = getStaticDI(ThemingService);

  const place = (type: BuiltInComponentType, pos: [number, number]) =>
    Component.deserialize(
      { pos, options: { direction: 0 } },
      provider.getComponent(type)!
    );
  const lever = place(BuiltInComponentType.LEVER, [0, 0]);
  const not = place(BuiltInComponentType.NOT, [6, 0]);
  const and = place(BuiltInComponentType.AND, [12, 0]);
  const wireBetween = (
    a: { x: number; y: number },
    b: { x: number; y: number }
  ) => {
    const horizontal = a.y === b.y;
    const wire = new Wire(
      horizontal ? WireDirection.HORIZONTAL : WireDirection.VERTICAL,
      horizontal ? Math.abs(b.x - a.x) : Math.abs(b.y - a.y)
    );
    wire.position.set(Math.min(a.x, b.x), Math.min(a.y, b.y));
    return wire;
  };
  const wires = [
    wireBetween(lever.connectionPoints[0], not.connectionPoints[0]),
    wireBetween(not.connectionPoints[1], and.connectionPoints[0])
  ];
  const components = [lever, not, and];
  const project = buildProject(components, wires);

  // multiView only matters on the WebGL branch: WebGPU and Canvas drive
  // multiple target canvases natively.
  const renderer = await autoDetectRenderer({
    preference: preference ?? 'webgpu',
    webgl: { multiView: true },
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
    backgroundColor: theming.currentTheme().background,
    antialias: true,
    hello: false
  });
  const mode = RendererType[renderer.type];
  console.log('[spike] watch renderer backend:', mode);

  const canvases = [makeCanvas(), makeCanvas()];
  const state: SpikeState = {
    renderer,
    project,
    wires,
    components,
    canvases,
    powered: false
  };

  fitToContent(project);
  buildOverlay(state, mode);
  renderAll(state);
  return mode;
}

function makeCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = VIEW_WIDTH;
  canvas.height = VIEW_HEIGHT;
  canvas.style.width = `${VIEW_WIDTH}px`;
  canvas.style.height = `${VIEW_HEIGHT}px`;
  return canvas;
}

/** Centers the content in the spike view (plain transform, no zoom ladder). */
function fitToContent(project: Project): void {
  const bounds = project.getContentBounds();
  if (!bounds) return;
  const gs = environment.gridSize;
  const margin = 2 * gs;
  const scale = Math.min(
    1,
    (VIEW_WIDTH - 2 * margin) / (bounds.width * gs),
    (VIEW_HEIGHT - 2 * margin) / (bounds.height * gs)
  );
  project.scale.set(scale);
  project.position.set(
    VIEW_WIDTH / 2 - (bounds.x + bounds.width / 2) * gs * scale,
    VIEW_HEIGHT / 2 - (bounds.y + bounds.height / 2) * gs * scale
  );
  project.setGridVisible(false);
}

function renderAll(state: SpikeState): void {
  // No CullerPlugin runs on manual renders; force the subtree visible.
  uncull(state.project);
  for (const canvas of state.canvases) {
    state.renderer.render({ container: state.project, target: canvas });
  }
}

function uncull(container: Container): void {
  container.culled = false;
  for (const child of container.children) {
    uncull(child as Container);
  }
}

function togglePower(state: SpikeState): void {
  state.powered = !state.powered;
  for (const wire of state.wires) {
    wire.setPowered(state.powered);
  }
  const [lever, not, and] = state.components;
  lever.setPortPowered(0, state.powered);
  not.setPortPowered(0, state.powered);
  not.setPortPowered(1, state.powered);
  and.setPortPowered(0, state.powered);
  renderAll(state);
}

function destroySpike(state: SpikeState): void {
  document.getElementById(OVERLAY_ID)?.remove();
  state.renderer.destroy();
  state.project.destroy({ children: true });
}

function buildOverlay(state: SpikeState, mode: string): void {
  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.style.cssText =
    'position:fixed;top:60px;right:16px;z-index:10000;display:flex;' +
    'flex-direction:column;gap:8px;padding:8px;background:#222;color:#eee;' +
    'border:1px solid #555;border-radius:6px;font:12px monospace';

  const title = document.createElement('div');
  title.textContent = `watch renderer spike — ${mode}`;
  overlay.appendChild(title);
  for (const canvas of state.canvases) {
    overlay.appendChild(canvas);
  }

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px';
  const button = (label: string, onClick: () => void) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'padding:2px 8px;background:#444;border-radius:4px';
    b.addEventListener('click', onClick);
    row.appendChild(b);
    return b;
  };
  button('re-render', () => renderAll(state));
  button('toggle power', () => togglePower(state));
  button('close', () => destroySpike(state));
  overlay.appendChild(row);

  document.body.appendChild(overlay);
}
