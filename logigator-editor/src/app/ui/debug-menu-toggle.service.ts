import { Injectable, signal, type Signal } from '@angular/core';

declare global {
  interface Window {
    /**
     * Turns the title-bar "Debug" menu on (no argument) or off (`false`) and
     * returns the new state. Installed in every build.
     */
    __logigatorDebug?: (enabled?: boolean) => boolean;
  }
}

/**
 * Owns whether the title-bar "Debug" menu is part of the menu models, and
 * publishes the `window.__logigatorDebug()` console command that flips it.
 *
 * Holds no dependencies on purpose: it is constructed at startup in every
 * build, while `DebugMenuService` and the services its commands reach stay
 * unresolved until the menu is switched on.
 *
 * `DEBUG_MENU` is the *initial* state, not a gate — the debug menu's module
 * ships in every build so the console command has something to enable. State
 * is session-only.
 */
@Injectable({ providedIn: 'root' })
export class DebugMenuToggleService {
  private readonly _enabled = signal(DEBUG_MENU);

  public readonly enabled: Signal<boolean> = this._enabled.asReadonly();

  /**
   * Publishes the console command. The menu models are computed off
   * {@link enabled}, so a console write schedules change detection like any
   * other signal write.
   */
  public install(): void {
    window.__logigatorDebug = (enabled = true): boolean => this.set(enabled);
  }

  /** Returns the new state so a console call echoes what it did. */
  public set(enabled: boolean): boolean {
    this._enabled.set(enabled);
    // Raw console rather than LoggingService: `loggingVerbosity` drops an
    // `info` in exactly the builds this command exists for.
    // eslint-disable-next-line no-console
    console.log(`[logigator] debug menu ${enabled ? 'enabled' : 'disabled'}`);
    return enabled;
  }
}
