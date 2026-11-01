import type { Provider } from '@angular/core';
import {
  type TurnstileApi,
  TurnstileLoader,
  type TurnstileRenderOptions
} from '../app/forms/turnstile/turnstile-loader';

/** `window.turnstile` without Cloudflare: widgets are records a spec solves. */
export class FakeTurnstile implements TurnstileApi {
  /** The widgets currently rendered, by id. */
  public readonly widgets = new Map<string, TurnstileRenderOptions>();
  /** Ids passed to `reset`, in order. */
  public readonly resets: string[] = [];
  private nextId = 0;

  public render(_container: HTMLElement, options: TurnstileRenderOptions) {
    const id = `widget-${++this.nextId}`;
    this.widgets.set(id, options);
    return id;
  }

  public reset(widgetId: string): void {
    this.resets.push(widgetId);
  }

  public remove(widgetId: string): void {
    this.widgets.delete(widgetId);
  }

  /** The one widget on the page; a spec with more is asking the wrong thing. */
  public only(): TurnstileRenderOptions {
    const [widget, ...others] = this.widgets.values();
    if (!widget || others.length) {
      throw new Error(`${this.widgets.size} widgets are rendered`);
    }
    return widget;
  }

  /** Solves the page's widget, as a visitor passing the challenge does. */
  public solve(token: string): void {
    this.only().callback(token);
  }
}

/** Serves `fake` in place of Cloudflare's script. */
export function provideFakeTurnstile(fake: FakeTurnstile): Provider {
  return {
    provide: TurnstileLoader,
    useValue: { load: () => Promise.resolve(fake) }
  };
}
