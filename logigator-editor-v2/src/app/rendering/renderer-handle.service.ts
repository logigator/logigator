import { Injectable } from '@angular/core';
import { Renderer } from 'pixi.js';

/**
 * Holds a reference to the live PixiJS renderer owned by {@link BoardComponent}.
 * Lets non-canvas services (image export, server previews, a future minimap)
 * render the scene into offscreen textures without reaching into the component.
 * BoardComponent registers the renderer once the app has initialised and clears
 * it on teardown.
 */
@Injectable({
  providedIn: 'root'
})
export class RendererHandleService {
  private _renderer: Renderer | null = null;

  public set(renderer: Renderer | null): void {
    this._renderer = renderer;
  }

  public get renderer(): Renderer | null {
    return this._renderer;
  }

  public get available(): boolean {
    return this._renderer !== null;
  }
}
