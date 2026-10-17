import {
  Component,
  DestroyRef,
  inject,
  input,
  model,
  signal
} from '@angular/core';
import { fromEvent, Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LgButton, LgShortcut, LgTooltip } from '@logigator/ui';
import {
  MODIFIER_FLAG_BY_KEY,
  ShortcutBinding
} from '../shortcut-binding.model';
import { ShortcutService } from '../shortcut.service';
import { TranslateDirective } from '../../translation/translate.directive';

@Component({
  selector: 'app-shortcut-edit',
  imports: [LgButton, LgShortcut, LgTooltip, TranslateDirective],
  templateUrl: './shortcut-edit.component.html'
})
export class ShortcutEditComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly shortcutService = inject(ShortcutService);

  public readonly binding = model.required<ShortcutBinding | null>();

  /**
   * Accept a bare modifier as the binding. Only hold-style actions want this:
   * a trigger action so bound would fire on every modified shortcut.
   */
  public readonly allowModifierOnly = input(false);

  protected readonly isRecording = signal(false);

  private static readonly MODIFIER_KEYS = new Set([
    'Control',
    'Shift',
    'Alt',
    'Meta',
    'OS'
  ]);

  private _recordSub?: Subscription;

  protected startRecording(): void {
    this.isRecording.set(true);
    this.shortcutService.disable();
    this._recordSub = fromEvent<KeyboardEvent>(window, 'keydown')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((e) => this._handleRecordKey(e));
  }

  protected stopRecording(): void {
    this._recordSub?.unsubscribe();
    this._recordSub = undefined;
    this.isRecording.set(false);
    this.shortcutService.enable();
  }

  private _handleRecordKey(e: KeyboardEvent): void {
    e.preventDefault();
    e.stopPropagation();
    if (ShortcutEditComponent.MODIFIER_KEYS.has(e.key)) {
      if (!this.allowModifierOnly()) return;
      // The recorded key's own flag stays false so the binding displays as
      // "Alt", not "Alt + Alt"; matchers skip that flag.
      const binding: ShortcutBinding = {
        key: e.key,
        ctrl: e.ctrlKey || e.metaKey,
        shift: e.shiftKey,
        alt: e.altKey
      };
      const own = MODIFIER_FLAG_BY_KEY[e.key];
      if (own) binding[own] = false;
      this.binding.set(binding);
      this.stopRecording();
      return;
    }
    if (e.key === 'Escape') {
      this.stopRecording();
      return;
    }
    this.binding.set({
      key: e.key,
      ctrl: e.ctrlKey || e.metaKey,
      shift: e.shiftKey,
      alt: e.altKey
    });
    this.stopRecording();
  }
}
