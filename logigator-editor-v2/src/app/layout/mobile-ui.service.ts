import { computed, Injectable, signal } from '@angular/core';

/** The bottom/side sheets the compact chrome can show, one at a time. */
export type MobileSheet = 'palette' | 'settings' | 'ports' | 'menu';

/**
 * Single source of truth for which mobile sheet (Drawer) is open. Several
 * Drawers plus the HUD's "Parts" affordance need to agree, and only one sheet
 * shows at a time — opening one closes the rest.
 */
@Injectable({ providedIn: 'root' })
export class MobileUiService {
  private readonly _activeSheet = signal<MobileSheet | null>(null);
  public readonly activeSheet = computed(this._activeSheet);

  public open(sheet: MobileSheet): void {
    this._activeSheet.set(sheet);
  }

  public close(): void {
    this._activeSheet.set(null);
  }

  public toggle(sheet: MobileSheet): void {
    this._activeSheet.update((current) => (current === sheet ? null : sheet));
  }

  public isOpen(sheet: MobileSheet): boolean {
    return this._activeSheet() === sheet;
  }
}
