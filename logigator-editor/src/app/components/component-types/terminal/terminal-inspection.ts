import { computed, signal, Signal } from '@angular/core';
import { TranslationService } from '../../../translation/translation.service';
import { SimulationService } from '../../../simulation/simulation.service';
import { getStaticDI } from '../../../utils/get-di';
import type { DocsTarget } from '../../../documentation/docs-target';
import { DOCS_LINKS } from '../../../documentation/docs-links';
import { ComponentInspection } from '../../component-inspection';
import type {
  TerminalScrollbackEntry,
  TerminalScreenView
} from './terminal-screen';
import type { TerminalComponent } from './terminal.component';
import { TerminalInspectionComponent } from './terminal-inspection.component';

/** One row of the screen as the window shows it. */
export interface TerminalScreenLine {
  readonly kind: 'row';
  readonly text: string;
  /** The cursor's column on this row, or `null` when it is on another one. */
  readonly cursor: number | null;
}

/**
 * One line of the window: the scrollback's entries, then the screen's rows,
 * each followed by the marker of what was lost after it.
 */
export type TerminalLine = TerminalScrollbackEntry | TerminalScreenLine;

type TerminalLostLine = Extract<TerminalScrollbackEntry, { kind: 'lost' }>;

/** How far above the bottom, in px, still counts as at the bottom. */
const BOTTOM_SLACK = 1;

/**
 * The window's text: one line per logical line, the scrollback's then the
 * screen's, a wrapped row joined with the row it continues on, a lost
 * marker as `lostLine` says it, and the empty lines at the end left out.
 */
export function terminalTranscript(
  screen: TerminalScreenView,
  lostLine: (count: number) => string
): string {
  const lines: string[] = [];
  let open: string | null = null;
  const add = (text: string, wrapped: boolean) => {
    open = (open ?? '') + text;
    if (!wrapped) {
      lines.push(open);
      open = null;
    }
  };
  const lost = (count: number) => {
    if (open !== null) {
      lines.push(open);
      open = null;
    }
    lines.push(lostLine(count));
  };
  for (
    let index = screen.scrollbackStart;
    index < screen.scrollbackEnd;
    index++
  ) {
    const entry = screen.scrollbackAt(index)!;
    if (entry.kind === 'lost') {
      lost(entry.count);
    } else {
      add(entry.text, entry.wrapped);
    }
  }
  for (let row = 0; row < screen.rows; row++) {
    add(screen.rowText(row), screen.rowWrapped(row));
    if (screen.rowLost(row) > 0) {
      lost(screen.rowLost(row));
    }
  }
  if (open !== null) {
    lines.push(open);
  }
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines.join('\n');
}

/**
 * A terminal's window: its scrollback, then its screen with the cursor,
 * read off the component, which folds in the records whether a window is
 * open or not.
 *
 * The window follows the bottom as lines arrive while the reader is there.
 * Scrolling up stops it, and reaching the bottom again, by scrolling or
 * because a stop emptied the scrollback, starts it again.
 */
export class TerminalInspection extends ComponentInspection {
  public readonly kind = 'terminal';
  public override readonly docs = signal<DocsTarget>(DOCS_LINKS.terminalOutput);
  public readonly renderer = TerminalInspectionComponent;
  public readonly title: Signal<string>;
  public override readonly sizing = {
    initial: { width: 440, height: 360 },
    min: { width: 280, height: 200 }
  };

  private readonly simulation = getStaticDI(SimulationService);
  private readonly translation = getStaticDI(TranslationService);

  private readonly _following = signal(true);
  /** Whether the window keeps the newest line in view. */
  public readonly following = this._following.asReadonly();

  // One array, kept up to date in place: the scrollback's part only gains
  // entries at the end and loses them at the front, the screen's is rebuilt.
  private readonly _lines: TerminalLine[] = [];
  // The scrollback indices `_lines` holds, `[_start, _end)`.
  private _start = 0;
  private _end = 0;
  private _version = -1;
  // The row and marker objects last handed out, kept while unchanged so a
  // view keeps the rows it drew.
  private rowLines: TerminalScreenLine[] = [];
  private lostMarkers: TerminalLostLine[] = [];
  private lastTop = 0;
  private seenResets: number;

  constructor(public readonly component: TerminalComponent) {
    super();
    this.title = computed(() =>
      this.translation.translate('components.def.TERMINAL.name')
    );
    this.seenResets = this.simulation.resets();
  }

  /**
   * Every line the window shows, oldest first, the screen's rows last, as of
   * the last {@link update}. The same array throughout.
   */
  public get lines(): readonly TerminalLine[] {
    return this._lines;
  }

  /** The scrollback's index of the first line, which moves as the oldest go. */
  public get start(): number {
    return this._start;
  }

  /**
   * Brings {@link lines} up to the screen, at a cost of the lines that
   * changed. Answers how many lines left the front, which moves every line
   * after them up by as many.
   */
  public update(): number {
    const screen = this.component.screen;
    if (screen.version === this._version) {
      return 0;
    }
    this._version = screen.version;
    const lines = this._lines;
    lines.length = this._end - this._start;
    let moved = 0;
    if (
      lines.length > 0 &&
      screen.scrollbackAt(this._end - 1) === lines[lines.length - 1]
    ) {
      moved = screen.scrollbackStart - this._start;
      lines.splice(0, moved);
    } else {
      // Started over, or everything held is gone.
      lines.length = 0;
      this._end = screen.scrollbackStart;
    }
    this._start = screen.scrollbackStart;
    for (; this._end < screen.scrollbackEnd; this._end++) {
      lines.push(screen.scrollbackAt(this._end)!);
    }
    for (let row = 0; row < screen.rows; row++) {
      lines.push(this.screenLine(screen, row));
      const lost = screen.rowLost(row);
      if (lost > 0) {
        lines.push(this.lostMarker(row, lost));
      }
    }
    return moved;
  }

  /**
   * The reader's scroll position, `top` of at most `max`: at the bottom the
   * window follows; scrolled up from where it was, it stops. Moving down
   * short of the bottom, or the content growing under it, changes nothing.
   */
  public scrolled(top: number, max: number): void {
    if (max - top <= BOTTOM_SLACK) {
      this._following.set(true);
    } else if (top < this.lastTop) {
      this._following.set(false);
    }
    this.lastTop = top;
  }

  /** {@link terminalTranscript} of the terminal, lost markers translated. */
  public transcript(): string {
    return terminalTranscript(this.component.screen, (count) =>
      this.lostLine(count)
    );
  }

  /** What the window says for `count` characters lost. */
  public lostLine(count: number): string {
    return count === 1
      ? this.translation.translate('components.def.TERMINAL.window.lostOne')
      : this.translation.translate('components.def.TERMINAL.window.lostMany', {
          count: count.toLocaleString(this.translation.getActiveLang())
        });
  }

  public override onFrame(): void {
    const resets = this.simulation.resets();
    if (resets !== this.seenResets) {
      // The stop emptied the scrollback; the screen is all there is.
      this.seenResets = resets;
      this.lastTop = 0;
      this._following.set(true);
    }
  }

  private screenLine(
    screen: TerminalScreenView,
    row: number
  ): TerminalScreenLine {
    const text = screen.rowText(row);
    const cursor = screen.cursorRow === row ? screen.cursorColumn : null;
    const last = this.rowLines[row];
    if (last && last.text === text && last.cursor === cursor) {
      return last;
    }
    return (this.rowLines[row] = { kind: 'row', text, cursor });
  }

  private lostMarker(row: number, count: number): TerminalLostLine {
    const last = this.lostMarkers[row];
    if (last && last.count === count) {
      return last;
    }
    return (this.lostMarkers[row] = { kind: 'lost', count });
  }
}
