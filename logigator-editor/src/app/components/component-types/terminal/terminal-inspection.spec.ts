import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signal, WritableSignal } from '@angular/core';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { makeTerminal } from '../../../../testing/factories';
import { SimulationService } from '../../../simulation/simulation.service';
import { TerminalComponent } from './terminal.component';
import { TerminalInspection, TerminalScreenLine } from './terminal-inspection';
import { TerminalScreenBuffer } from './terminal-screen';

function records(text: string): Uint32Array {
  return Uint32Array.from([...text].map((char) => char.charCodeAt(0)));
}

describe('TerminalInspection', () => {
  let resets: WritableSignal<number>;
  let terminal: TerminalComponent;
  let inspection: TerminalInspection;
  let next: number;

  beforeEach(() => {
    resets = signal(0);
    configureTestBed([{ provide: SimulationService, useValue: { resets } }]);
    terminal = makeTerminal({ columns: 8, rows: 3 });
    inspection = new TerminalInspection(terminal);
    next = 0;
  });

  afterEach(() => {
    terminal.destroy({ children: true });
  });

  /** Folds `text` in as the next records. */
  function print(text: string): void {
    terminal.applyRecords(next, records(text));
    next += text.length;
  }

  describe('following the bottom', () => {
    it('follows from the start and stops once the reader scrolls up', () => {
      expect(inspection.following()).toBe(true);
      inspection.scrolled(400, 400);
      inspection.scrolled(380, 400);
      expect(inspection.following()).toBe(false);
    });

    it('keeps following while the content grows under a view not yet scrolled down', () => {
      inspection.scrolled(400, 400);
      inspection.scrolled(400, 440);
      inspection.scrolled(420, 440);
      expect(inspection.following()).toBe(true);
    });

    it('stays put while the reader scrolls down short of the bottom, and follows again at it', () => {
      inspection.scrolled(400, 400);
      inspection.scrolled(100, 400);
      inspection.scrolled(250, 400);
      expect(inspection.following()).toBe(false);
      inspection.scrolled(399.5, 400);
      expect(inspection.following()).toBe(true);
    });

    it('follows again after a stop, the scrollback gone', () => {
      print('a\nb\nc\nd\n');
      inspection.scrolled(0, 40);
      inspection.scrolled(0, 40);
      inspection.scrolled(20, 40);
      inspection.scrolled(10, 40);
      expect(inspection.following()).toBe(false);

      terminal.clearSimState();
      resets.set(1);
      inspection.onFrame();

      expect(inspection.following()).toBe(true);
      inspection.update();
      expect(inspection.lines).toEqual([
        { kind: 'row', text: '', cursor: 0 },
        { kind: 'row', text: '', cursor: null },
        { kind: 'row', text: '', cursor: null }
      ]);
    });
  });

  describe('lines', () => {
    it('are the scrollback, lost markers after the line they followed, then the screen rows with the cursor on its row', () => {
      print('one\ntwo\n');
      terminal.applyRecords(next + 5, records('x\ny\nz'));
      inspection.update();

      expect(inspection.lines).toEqual([
        { kind: 'line', text: 'one', wrapped: false },
        { kind: 'line', text: 'two', wrapped: false },
        { kind: 'lost', count: 5 },
        { kind: 'row', text: 'x', cursor: null },
        { kind: 'row', text: 'y', cursor: null },
        { kind: 'row', text: 'z', cursor: 1 }
      ]);
    });

    it('show a marker after its screen row while the row is still on the screen', () => {
      print('ab');
      terminal.applyRecords(next + 5, records('cd\nef'));
      inspection.update();

      expect(inspection.lines).toEqual([
        { kind: 'row', text: 'abcd', cursor: null },
        { kind: 'lost', count: 5 },
        { kind: 'row', text: 'ef', cursor: 2 },
        { kind: 'row', text: '', cursor: null }
      ]);
    });

    it('keep the line objects of rows that did not change', () => {
      print('ab\ncd');
      inspection.update();
      const before = [...inspection.lines];
      print('e');
      inspection.update();
      const after = inspection.lines;

      expect(after[0]).toBe(before[0]);
      expect(after[2]).toBe(before[2]);
      expect(after[1]).not.toBe(before[1]);
      expect((after[1] as TerminalScreenLine).text).toBe('cde');
    });

    it('report where the scrollback starts, which moves as the oldest lines go', () => {
      print('\n'.repeat(10_000));
      inspection.update();
      expect(inspection.start).toBe(0);
      print('\n'.repeat(5));
      expect(inspection.update()).toBe(10_005 - 2 - 10_000);
      expect(inspection.start).toBe(10_005 - 2 - 10_000);
      expect(inspection.lines).toHaveLength(10_000 + 3);
    });

    it('read only the scrollback entries a frame added, in place in one array', () => {
      print('\n'.repeat(10_005));
      inspection.update();
      const lines = inspection.lines;
      const before = [...lines];
      const read = vi.spyOn(
        terminal.screen as TerminalScreenBuffer,
        'scrollbackAt'
      );

      // A frame that changes only the screen.
      print('x');
      expect(inspection.update()).toBe(0);
      expect(inspection.lines).toBe(lines);
      expect(read.mock.calls.length).toBeLessThanOrEqual(1);
      expect(
        lines.slice(0, 10_000).every((line, i) => line === before[i])
      ).toBe(true);

      // Three lines scroll off: three leave the front, three are read.
      read.mockClear();
      print('\n\n\n');
      expect(inspection.update()).toBe(3);
      expect(read.mock.calls.length).toBeLessThanOrEqual(1 + 3);
      expect(
        lines.slice(0, 10_000 - 3).every((line, i) => line === before[i + 3])
      ).toBe(true);
      expect(lines.slice(10_000 - 3, 10_000)).toEqual([
        { kind: 'line', text: '', wrapped: false },
        { kind: 'line', text: '', wrapped: false },
        { kind: 'line', text: 'x', wrapped: false }
      ]);
    });

    it('start over when a stop empties the scrollback, though as many lines arrive again', () => {
      print('a\nb\nc\nd\n');
      inspection.update();
      terminal.clearSimState();
      next = 0;
      print('e\nf\ng\nh\n');
      inspection.update();

      expect(inspection.lines.slice(0, 2)).toEqual([
        { kind: 'line', text: 'e', wrapped: false },
        { kind: 'line', text: 'f', wrapped: false }
      ]);
    });
  });

  describe('transcript', () => {
    it('joins a wrapped line with its continuation, across the scrollback and the screen', () => {
      print('abcdefghij\nk');
      // `abcdefgh` wrapped into `ij`, then `k` on its own line.
      print('\n0123456789');

      expect(inspection.transcript()).toBe('abcdefghij\nk\n0123456789');
    });

    it('puts a lost marker on a line of its own, ending a wrapped line before it, on the screen and off it', () => {
      // Lost while `abcdefgh` waits to wrap into `ij`.
      print('abcdefgh');
      terminal.applyRecords(next + 3, records('ij'));
      next += 3 + 2;
      const expected = ['abcdefgh', inspection.lostLine(3), 'ij'].join('\n');
      expect(inspection.transcript()).toBe(expected);

      print('\n\n\n');
      expect(terminal.screen.scrollbackEnd).toBe(3);
      expect(inspection.transcript()).toBe(expected);
    });

    it('leaves out the empty lines at the end and keeps those between', () => {
      print('top\n\n\nbottom\n');

      expect(inspection.transcript()).toBe('top\n\n\nbottom');
    });

    it('is empty for a screen nothing was printed to', () => {
      expect(inspection.transcript()).toBe('');
    });
  });
});
