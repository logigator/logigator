import {
  ChangeDetectionStrategy,
  Component,
  input,
  output
} from '@angular/core';
import { LgButton, LgCaret, type LgOverlaySide } from '@logigator/ui';
import { TranslateDirective } from '../../translation/translate.directive';

/**
 * Presentational just-in-time hint: a small, non-blocking popover with the hint
 * body and a dismiss button, anchored or centred by the controller.
 */
@Component({
  selector: 'app-hint-popover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Block, so the controller can shift the popover inside its overlay pane: a
  // transform has no effect on an inline host.
  host: { class: 'block' },
  imports: [TranslateDirective, LgButton, LgCaret],
  template: `
    <div
      *appTranslate="let t"
      class="pointer-events-auto relative flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-lg border border-border bg-content p-3 shadow-lg"
      role="status"
    >
      @if (side(); as s) {
        <lg-caret [side]="s" [offset]="caretOffset()" />
      }
      <!-- Our own translated markup; trusted content. -->
      <p class="text-sm text-muted" [innerHTML]="text()"></p>
      <div class="flex items-center justify-end gap-1">
        @if (hasDocsLink()) {
          <lg-button
            class="mr-auto"
            size="sm"
            severity="secondary"
            text
            [label]="t('documentation.learnMore')"
            (onClick)="learnMore.emit()"
          ></lg-button>
        }
        <lg-button
          size="sm"
          severity="secondary"
          text
          [label]="t('onboarding.bubble.turnOff')"
          (onClick)="disableTips.emit()"
        ></lg-button>
        <lg-button
          size="sm"
          severity="secondary"
          text
          icon="ph ph-x"
          [ariaLabel]="t('onboarding.hints.dismiss')"
          (onClick)="dismiss.emit()"
        ></lg-button>
      </div>
    </div>
  `
})
export class HintPopoverComponent {
  public readonly text = input.required<string>();
  public readonly side = input<LgOverlaySide | null>(null);
  /** Slides the caret along the panel edge to keep it on the anchor. */
  public readonly caretOffset = input(0);
  /** Whether the hint links to a documentation page. */
  public readonly hasDocsLink = input(false);

  public readonly dismiss = output<void>();
  public readonly disableTips = output<void>();
  public readonly learnMore = output<void>();
}
