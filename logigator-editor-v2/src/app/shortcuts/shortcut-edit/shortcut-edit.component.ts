import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  model,
  signal
} from '@angular/core';
import { fromEvent, Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { TranslocoDirective } from '@jsverse/transloco';
import { ShortcutDisplayComponent } from '../shortcut-display/shortcut-display.component';
import { ShortcutBinding } from '../shortcut-binding.model';
import { ShortcutService } from '../shortcut.service';

@Component({
  selector: 'app-shortcut-edit',
  imports: [
    ButtonModule,
    TooltipModule,
    TranslocoDirective,
    ShortcutDisplayComponent
  ],
  templateUrl: './shortcut-edit.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShortcutEditComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly shortcutService = inject(ShortcutService);

  public readonly binding = model.required<ShortcutBinding | null>();

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
    if (ShortcutEditComponent.MODIFIER_KEYS.has(e.key)) return;
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
