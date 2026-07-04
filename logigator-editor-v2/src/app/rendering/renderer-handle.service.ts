import { computed, Injectable, signal } from '@angular/core';
import { Renderer } from 'pixi.js';

/**
 * Holds a reference to the live PixiJS renderer owned by {@link BoardComponent}.
 * Lets non-canvas services (image export, server previews, the minimap) render
 * the scene into offscreen textures without reaching into the component.
 * BoardComponent registers the renderer once the app has initialised and clears
 * it on teardown. `available` is a signal so overlays (the minimap) can gate
 * their render on renderer readiness reactively.
 */
@Injectable({
  providedIn: 'root'
})
export class RendererHandleService {
  private readonly _renderer = signal<Renderer | null>(null);

  public set(renderer: Renderer | null): void {
    this._renderer.set(renderer);
  }

  public get renderer(): Renderer | null {
    return this._renderer();
  }

  public readonly available = computed(() => this._renderer() !== null);
}
