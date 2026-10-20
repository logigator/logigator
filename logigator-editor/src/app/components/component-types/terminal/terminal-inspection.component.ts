import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild
} from '@angular/core';
import { ArrayDataSource } from '@angular/cdk/collections';
import { BehaviorSubject } from 'rxjs';
import { copyText, LgButton, LgScroller } from '@logigator/ui';
import { ToastService } from '../../../logging/toast.service';
import { TranslateDirective } from '../../../translation/translate.directive';
import { TranslationService } from '../../../translation/translation.service';
import type {
  TerminalInspection,
  TerminalLine,
  TerminalScreenLine
} from './terminal-inspection';

/** Roboto Mono's advance, in em. */
const ADVANCE_EM = 0.6;
const LINE_EM = 1.4;
/** The font sizes, in px, the window scales between to fit its columns. */
const MIN_FONT_PX = 10;
const MAX_FONT_PX = 20;
/** A line's horizontal padding, in px, on either side. */
const LINE_PADDING_PX = 8;

/** A screen row split around the cursor cell. */
interface CursorParts {
  readonly before: string;
  readonly at: string;
  readonly after: string;
}

/** `line` split around its cursor; past the row's text the cell is a space. */
function cursorParts(line: TerminalScreenLine, column: number): CursorParts {
  return {
    before: line.text.slice(0, column).padEnd(column),
    at: line.text[column] ?? ' ',
    after: line.text.slice(column + 1)
  };
}

/**
 * The terminal's window: the scrollback, then the screen as a tinted band
 * with the cursor cell marked, one line per row at the terminal's own column
 * count. The font scales so every column fits the width, down to a minimum,
 * and scrolls sideways below it. Only the lines in view are rendered.
 *
 * The lines reach the viewport as one array updated in place, so a frame
 * costs what changed in it. While the inspection follows, a change of the
 * content's height or of the view's scrolls to the bottom; while it does not,
 * the lines in view stay in place as the oldest leave the scrollback.
 */
@Component({
  selector: 'app-terminal-inspection',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LgButton, LgScroller, TranslateDirective],
  host: { class: 'flex h-full flex-col gap-2' },
  template: `
    <ng-container *appTranslate="let t">
      <lg-scroller
        class="min-h-0 grow overflow-hidden rounded-md border border-border"
        tabindex="0"
        [items]="source"
        [itemSize]="lineHeight()"
        scrollHeight="100%"
        [style]="{ 'scrollbar-gutter': 'stable' }"
        styleClass="w-full font-mono outline-none"
        (scrolled)="onScroll()"
      >
        <ng-template #item let-line>
          <div
            class="whitespace-pre"
            [class.bg-content-hover]="line.kind === 'row'"
            [style.height.px]="lineHeight()"
            [style.line-height.px]="lineHeight()"
            [style.font-size.px]="fontSize()"
            [style.min-width]="lineWidth()"
            [style.padding-inline.px]="padding"
          >
            @switch (line.kind) {
              @case ('lost') {
                <span class="font-sans text-muted italic">{{
                  inspection().lostLine(line.count)
                }}</span>
              }
              @case ('row') {
                @if (line.cursor !== null) {
                  @let parts = cursor(line);
                  <span>{{ parts.before }}</span
                  ><span class="bg-primary text-primary-contrast">{{
                    parts.at
                  }}</span
                  ><span>{{ parts.after }}</span>
                } @else {
                  <span>{{ line.text }}</span>
                }
              }
              @default {
                <span>{{ line.text }}</span>
              }
            }
          </div>
        </ng-template>
      </lg-scroller>

      <div class="flex shrink-0 justify-end">
        <button
          lgButton
          icon="ph ph-copy"
          severity="secondary"
          [outlined]="true"
          size="sm"
          (onClick)="copyAll()"
        >
          {{ t('components.def.TERMINAL.window.copyAll') }}
        </button>
      </div>
    </ng-container>
  `
})
export class TerminalInspectionComponent {
  public readonly inspection = input.required<TerminalInspection>();

  private readonly toast = inject(ToastService);
  private readonly translation = inject(TranslationService);
  private readonly scroller = viewChild.required(LgScroller);

  protected readonly padding = LINE_PADDING_PX;
  private readonly lines = new BehaviorSubject<readonly TerminalLine[]>([]);
  protected readonly source = new ArrayDataSource(this.lines);
  private readonly width = signal(0);

  private readonly columns = computed(
    () => this.inspection().component.screen.columns
  );
  protected readonly fontSize = computed(() => {
    const fit =
      (this.width() - 2 * LINE_PADDING_PX) / (this.columns() * ADVANCE_EM);
    return Math.min(
      MAX_FONT_PX,
      Math.max(MIN_FONT_PX, Math.floor(fit * 4) / 4)
    );
  });
  protected readonly lineHeight = computed(() =>
    Math.round(this.fontSize() * LINE_EM)
  );
  protected readonly lineWidth = computed(
    () => `calc(${this.columns()}ch + ${2 * LINE_PADDING_PX}px)`
  );

  constructor() {
    let first = true;
    effect(() => {
      const inspection = this.inspection();
      inspection.component.version();
      untracked(() => {
        const moved = inspection.update();
        // Anchored before the viewport takes the moved lines, so the rows it
        // renders for them are the ones in view.
        if (!first && moved > 0 && !inspection.following()) {
          const scroller = this.scroller();
          scroller.viewportElement.scrollTop -= moved * this.lineHeight();
          scroller.checkViewportSize();
        }
        first = false;
        this.lines.next(inspection.lines);
      });
    });

    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const viewport = this.scroller().viewportElement;
      this.width.set(viewport.clientWidth);
      // Guarded for test environments without ResizeObserver.
      if (typeof ResizeObserver === 'undefined') return;
      // The spacer is as tall as every line: it grows with the content and
      // with the font.
      const spacer = viewport.querySelector('.cdk-virtual-scroll-spacer');
      const observer = new ResizeObserver(() => {
        this.width.set(viewport.clientWidth);
        if (this.inspection().following()) {
          viewport.scrollTop = viewport.scrollHeight;
        }
      });
      observer.observe(viewport);
      if (spacer) observer.observe(spacer);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  protected cursor(line: TerminalScreenLine): CursorParts {
    return cursorParts(line, line.cursor ?? 0);
  }

  protected onScroll(): void {
    const viewport = this.scroller().viewportElement;
    this.inspection().scrolled(
      viewport.scrollTop,
      viewport.scrollHeight - viewport.clientHeight
    );
  }

  protected async copyAll(): Promise<void> {
    if (await copyText(this.inspection().transcript())) {
      this.toast.success(
        this.translation.translate('components.def.TERMINAL.window.copied'),
        'TerminalInspectionComponent'
      );
      return;
    }
    this.toast.error(
      this.translation.translate('components.def.TERMINAL.window.copyFailed'),
      'TerminalInspectionComponent'
    );
  }
}
