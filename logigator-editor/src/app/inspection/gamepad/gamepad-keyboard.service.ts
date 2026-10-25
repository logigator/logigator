import { DestroyRef, DOCUMENT, inject, Injectable } from '@angular/core';
import { GamepadControlId } from '@logigator/core';
import { GamepadBindingsService } from '../../shortcuts/gamepad-bindings.service';
import { SimulationService } from '../../simulation/simulation.service';

/**
 * An open gamepad view that plays keys. It receives the bound keys pressed
 * while focus is inside `host`; a key's release reaches the target it was
 * pressed on wherever focus has gone since.
 */
export interface GamepadKeyTarget {
  /** The view's root element; focus inside it routes keys to this target. */
  readonly host: HTMLElement;
  /** `code`, bound to `control`, went down. Once per physical press. */
  keyDown(control: GamepadControlId, code: string): void;
  /** `code`, which pressed `control`, came back up. */
  keyUp(control: GamepadControlId, code: string): void;
  /**
   * Every key this target holds is released at once, without a `keyUp` per
   * key: focus left the view, the page lost focus, or the target was removed.
   */
  releaseKeys(): void;
}

interface HeldKey {
  readonly target: GamepadKeyTarget;
  readonly control: GamepadControlId;
}

const MODIFIER_CODES = {
  ctrl: new Set(['ControlLeft', 'ControlRight']),
  meta: new Set(['MetaLeft', 'MetaRight']),
  alt: new Set(['AltLeft', 'AltRight'])
};

/**
 * Routes the keyboard to the gamepad view that has DOM focus, and to nobody
 * otherwise. Its `keydown`/`keyup` listeners sit on `window` in the capture
 * phase, ahead of `ShortcutService`, so a key a gamepad plays is consumed
 * before it can trigger a shortcut; everything else passes through untouched.
 */
@Injectable({
  providedIn: 'root'
})
export class GamepadKeyboardService {
  private readonly document = inject(DOCUMENT);
  private readonly bindings = inject(GamepadBindingsService);
  private readonly simulation = inject(SimulationService);

  private readonly _targets = new Set<GamepadKeyTarget>();
  /** Every key down through this service, by code, with where it went. */
  private readonly _held = new Map<string, HeldKey>();
  private _listeners: AbortController | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this._listeners?.abort());
  }

  /**
   * Starts routing keys to `target` while focus is inside its host. The
   * returned function stops it, releasing whatever keys it still holds.
   */
  public register(target: GamepadKeyTarget): () => void {
    this.attachListeners();
    this._targets.add(target);
    return () => {
      if (!this._targets.delete(target)) return;
      this.release(target);
    };
  }

  private attachListeners(): void {
    if (this._listeners) return;
    this._listeners = new AbortController();
    const view = this.document.defaultView;
    if (!view) return;
    const options = { capture: true, signal: this._listeners.signal };
    view.addEventListener('keydown', (e) => this.onKeyDown(e), options);
    view.addEventListener('keyup', (e) => this.onKeyUp(e), options);
    view.addEventListener('focusout', (e) => this.onFocusOut(e), options);
    view.addEventListener('blur', () => this.releaseAll(), {
      signal: this._listeners.signal
    });
    this.document.addEventListener(
      'visibilitychange',
      () => {
        if (this.document.visibilityState === 'hidden') this.releaseAll();
      },
      { signal: this._listeners.signal }
    );
  }

  private onKeyDown(e: KeyboardEvent): void {
    const target = this.focusedTarget();
    if (!target) return;
    if (!this.simulation.isReady()) return;
    if (isTextEntry(e.target)) return;
    if (hasForeignModifier(e)) return;
    const control = this.bindings.controlFor(e.code);
    if (control === null) return;

    consume(e);
    // A repeat, or a second keydown without a keyup between, presses nothing.
    if (e.repeat || this._held.has(e.code)) return;
    this._held.set(e.code, { target, control });
    target.keyDown(control, e.code);
  }

  private onKeyUp(e: KeyboardEvent): void {
    const held = this._held.get(e.code);
    if (!held) return;
    consume(e);
    this._held.delete(e.code);
    held.target.keyUp(held.control, e.code);
  }

  private onFocusOut(e: FocusEvent): void {
    const next = e.relatedTarget instanceof Node ? e.relatedTarget : null;
    for (const target of this._targets) {
      if (
        e.target instanceof Node &&
        target.host.contains(e.target) &&
        !(next && target.host.contains(next))
      ) {
        this.release(target);
      }
    }
  }

  private focusedTarget(): GamepadKeyTarget | null {
    const active = this.document.activeElement;
    if (!active) return null;
    for (const target of this._targets) {
      if (target.host.contains(active)) return target;
    }
    return null;
  }

  /** Forgets `target`'s held keys and tells it, if it held any. */
  private release(target: GamepadKeyTarget): void {
    let held = false;
    for (const [code, entry] of this._held) {
      if (entry.target !== target) continue;
      this._held.delete(code);
      held = true;
    }
    if (held) target.releaseKeys();
  }

  private releaseAll(): void {
    const targets = new Set([...this._held.values()].map((h) => h.target));
    this._held.clear();
    for (const target of targets) target.releaseKeys();
  }
}

function consume(e: KeyboardEvent): void {
  e.preventDefault();
  e.stopImmediatePropagation();
}

/**
 * A held Ctrl, Meta or Alt makes the key a shortcut (Ctrl+S still saves),
 * unless the key is that modifier itself, which reports its own flag.
 */
function hasForeignModifier(e: KeyboardEvent): boolean {
  return (
    (e.ctrlKey && !MODIFIER_CODES.ctrl.has(e.code)) ||
    (e.metaKey && !MODIFIER_CODES.meta.has(e.code)) ||
    (e.altKey && !MODIFIER_CODES.alt.has(e.code))
  );
}

/** Keys typed into a field belong to the field. */
function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable ||
    target.closest('[contenteditable]:not([contenteditable="false"])') !== null
  );
}
