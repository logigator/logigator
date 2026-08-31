import { Injectable } from '@angular/core';
import { EditorSetting } from './editor-setting';

const STORAGE_KEY = 'logigator.settings';

/**
 * User-toggleable editor preferences, persisted together as one JSON object
 * under a single localStorage key. Every setting is exposed through `settings`
 * so the UI can render them generically; named accessors give typed reads.
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

  public readonly autoStartSimulation = new EditorSetting(
    'autoStartSimulation',
    'settings.options.autoStartSimulation',
    this.stored['autoStartSimulation'] ?? true,
    () => this.persist()
  );

  public readonly settings: readonly EditorSetting[] = [
    this.fpsCounter,
    this.showGrid,
    this.autoStartSimulation
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
