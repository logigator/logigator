import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output
} from '@angular/core';
import { GAMEPAD_CONTROLS, GamepadControlId, NameMap } from '@logigator/core';
import { TranslateDirective } from '../../../translation/translate.directive';
import { CANVAS_FONT_CHARS } from '../../../utils/text-fit';
import type { NameMapEditor } from '../../component-options/name-map/name-map-editor';
import { GamepadPadComponent } from './pad/gamepad-pad.component';

const CONTROL_IDS: ReadonlySet<string> = new Set(GAMEPAD_CONTROLS);

/** Whether the board's bitmap font has a glyph for `char`. */
function onCanvas(char: string): boolean {
  return CANVAS_FONT_CHARS.some(([from, to]) => char >= from && char <= to);
}

/**
 * The gamepad's names dialog body: the controller itself in `names` mode,
 * laid out for the pad's present controls, each caption an input whose
 * placeholder is the control's default name. Enter in any of them saves.
 *
 * A name may hold characters the board's bitmap font lacks: the window shows
 * them, the port labels drop them, and a note says so rather than refusing
 * them.
 */
@Component({
  selector: 'app-gamepad-names-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GamepadPadComponent, TranslateDirective],
  host: { class: 'flex flex-col gap-3' },
  template: `
    <app-gamepad-pad
      mode="names"
      [controls]="controls()"
      [(names)]="names"
      [maxLength]="maxLength()"
      (save)="save.emit()"
    />
    <div *appTranslate="let t" class="flex flex-col gap-1 text-sm">
      <p class="text-muted">{{ t('components.def.GAMEPAD.names.hint') }}</p>
      @if (offCanvas()) {
        <p class="flex items-start gap-1.5 text-warn-text" role="status">
          <i class="ph ph-warning mt-0.5" aria-hidden="true"></i>
          {{ t('components.def.GAMEPAD.names.outsideFont') }}
        </p>
      }
    </div>
  `
})
export class GamepadNamesEditorComponent implements NameMapEditor {
  public readonly keys = input.required<readonly string[]>();
  public readonly names = model.required<NameMap>();
  public readonly maxLength = input.required<number>();
  public readonly save = output<void>();

  protected readonly controls = computed(() =>
    this.keys().filter((key): key is GamepadControlId => CONTROL_IDS.has(key))
  );

  /** Whether a shown name has a character the board cannot draw. */
  protected readonly offCanvas = computed(() => {
    const names = this.names();
    return this.controls().some(
      (control) =>
        Object.hasOwn(names, control) &&
        [...names[control]].some((char) => !onCanvas(char))
    );
  });
}
