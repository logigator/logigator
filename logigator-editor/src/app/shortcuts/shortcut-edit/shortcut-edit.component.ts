import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  model,
  signal
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { fromEvent, Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  formatShortcutLabel,
  LgButton,
  LgShortcut,
  LgTooltip
} from '@logigator/ui';
import {
  MODIFIER_FLAG_BY_KEY,
  ShortcutBinding
} from '../shortcut-binding.model';
import { ShortcutService } from '../shortcut.service';
import { TranslateDirective } from '../../translation/translate.directive';

@Component({
  selector: 'app-shortcut-edit',
  imports: [
    LgButton,
    LgShortcut,
    LgTooltip,
    NgTemplateOutlet,
    TranslateDirective
  ],
  templateUrl: './shortcut-edit.component.html'
})
export class ShortcutEditComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly host =
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly shortcutService = inject(ShortcutService);

  /**
   * Every binding of the action. Each is re-recorded or removed on its own,
   * and a recording at the end adds one.
   */
  public readonly bindings = model.required<ShortcutBinding[]>();

  /**
   * Accept a bare modifier as the binding. Only hold-style actions want this:
   * a trigger action so bound would fire on every modified shortcut.
   */
  public readonly allowModifierOnly = input(false);

  /**
   * The slot being recorded: an existing binding's index, or the list's
   * length for a new one. `null` while not recording.
   */
  protected readonly recordingIndex = signal<number | null>(null);
  protected readonly isRecording = computed(
    () => this.recordingIndex() !== null
  );

  private static readonly MODIFIER_KEYS = new Set([
    'Control',
    'Shift',
    'Alt',
    'Meta',
    'OS'
  ]);

  private _recordSub?: Subscription;

  protected startRecording(index: number): void {
    this.stopRecording();
    this.recordingIndex.set(index);
    this.shortcutService.disable();
    this._recordSub = fromEvent<KeyboardEvent>(window, 'keydown')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((e) => this._handleRecordKey(e));
  }

  protected stopRecording(): void {
    this._recordSub?.unsubscribe();
    this._recordSub = undefined;
    if (this.recordingIndex() === null) return;
    this.recordingIndex.set(null);
    this.shortcutService.enable();
  }

  protected remove(index: number): void {
    this.bindings.set(this.bindings().filter((_, i) => i !== index));
  }

  protected label(binding: ShortcutBinding): string {
    return formatShortcutLabel(binding);
  }

  /**
   * Puts the recorded binding into its slot. One the action already holds
   * elsewhere leaves that slot, so the list never repeats a combination.
   */
  private _commit(binding: ShortcutBinding): void {
    const index = this.recordingIndex() ?? this.bindings().length;
    const next = [...this.bindings()];
    next.splice(index, 1, binding);
    this.bindings.set(
      next.filter(
        (other, i) =>
          i === index || !this.shortcutService.bindingEqual(other, binding)
      )
    );
    this.stopRecording();
  }

  private _handleRecordKey(e: KeyboardEvent): void {
    if (this._inOtherDialog(e.target)) return;
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
      this._commit(binding);
      return;
    }
    if (e.key === 'Escape') {
      this.stopRecording();
      return;
    }
    this._commit({
      key: e.key,
      ctrl: e.ctrlKey || e.metaKey,
      shift: e.shiftKey,
      alt: e.altKey
    });
  }

  /**
   * Whether a key landed in a dialog stacked over this one, such as the
   * documentation its header's help opened: typing there is no binding.
   */
  private _inOtherDialog(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    const dialog = target.closest('[role="dialog"]');
    return dialog !== null && !dialog.contains(this.host);
  }
}
