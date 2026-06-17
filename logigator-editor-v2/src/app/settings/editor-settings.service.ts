import { Injectable } from '@angular/core';
import { EditorSetting } from './editor-setting';

const STORAGE_KEY = 'logigator.settings';

/**
 * User-toggleable editor preferences. All settings are persisted together as a
 * single JSON object under one localStorage key. Expose every setting through
 * `settings` so the settings UI can render them generically; named accessors
 * stay for type-safe direct reads.
 */
@Injectable({
  providedIn: 'root'
})
export class EditorSettingsService {
  private readonly stored = this.load();

  public readonly fpsCounter = new EditorSetting(
    'fpsCounter',
    'settings.options.fpsCounter',
    this.stored['fpsCounter'] ?? false,
    () => this.persist()
  );

  public readonly showGrid = new EditorSetting(
    'showGrid',
    'settings.options.showGrid',
    this.stored['showGrid'] ?? true,
    () => this.persist()
  );

  public readonly settings: readonly EditorSetting[] = [
    this.fpsCounter,
    this.showGrid
  ];

  private load(): Record<string, boolean> {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    try {
      const parsed: unknown = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, boolean>)
        : {};
    } catch {
      return {};
    }
  }

  private persist(): void {
    const data: Record<string, boolean> = {};
    for (const setting of this.settings) {
      data[setting.key] = setting.value();
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}
