import { describe, expect, it } from 'vitest';
import { Point, Rectangle } from 'pixi.js';
import {
  SnapshotSpanIndex,
  snapshotsShareSpan,
  WireSnapshot
} from './wire-snapshot.model';
import { WireDirection } from './wire-direction.enum';

function h(x: number, y: number, length: number): WireSnapshot {
  return {
    start: new Point(x, y),
    end: new Point(x + length, y),
    direction: WireDirection.HORIZONTAL,
    gridBounds: new Rectangle(Math.floor(x), Math.floor(y), length + 1, 1)
  };
}

function v(x: number, y: number, length: number): WireSnapshot {
  return {
    start: new Point(x, y),
    end: new Point(x, y + length),
    direction: WireDirection.VERTICAL,
    gridBounds: new Rectangle(Math.floor(x), Math.floor(y), 1, length + 1)
  };
}

describe('SnapshotSpanIndex', () => {
  // The index answers the same question as a scan over every snapshot, which
  // is what the commit paths use it for — a divergence changes which wires a
  // paste or move keeps selected.
  it('answers exactly what a scan with snapshotsShareSpan answers', () => {
    const indexed = [
      h(2.5, 3.5, 4),
      h(5.5, 3.5, 3), // same row as the first, overlapping it
      h(2.5, 7.5, 2), // same axis position, different row
      v(2.5, 3.5, 4),
      v(9.5, 1.5, 6),
      v(9.5, 8.5, 2) // same column, disjoint from the one above
    ];
    const index = new SnapshotSpanIndex(indexed);

    const probes = [
      h(2.5, 3.5, 4), // identical to an indexed one
      h(0.5, 3.5, 3), // same row, overlaps
      h(-1.5, 3.5, 4), // same row, meets the first at its start only
      h(2.5, 4.5, 4), // parallel, one row off
      h(20.5, 3.5, 1), // same row, far away
      v(2.5, 5.5, 4), // same column as the vertical, overlaps
      v(2.5, 3.5, 0), // zero length: touch, never an overlap
      v(9.5, 7.5, 1), // same column, meets the lower one at its start only
      v(3.5, 3.5, 4), // one column off
      h(9.5, 1.5, 6) // crosses a vertical of matching coordinates
    ];

    for (const probe of probes) {
      expect(
        index.sharesSpan(probe),
        `probe ${probe.direction} (${probe.start.x}, ${probe.start.y})→(${probe.end.x}, ${probe.end.y})`
      ).toBe(indexed.some((s) => snapshotsShareSpan(s, probe)));
    }
  });

  it('finds a sharer on a line holding many snapshots', () => {
    // The bucket a probe lands in is scanned in full, so a line has to keep
    // every one of its snapshots — not just the last one added.
    const row = Array.from({ length: 50 }, (_, i) => h(i * 10 + 0.5, 4.5, 8));
    const index = new SnapshotSpanIndex(row);

    for (const s of row) {
      expect(index.sharesSpan(h(s.start.x + 2, 4.5, 3))).toBe(true);
    }
    // Between two of them: touches neither span.
    expect(index.sharesSpan(h(8.5, 4.5, 2))).toBe(false);
  });

  it('is empty for a line nothing was indexed on', () => {
    const index = new SnapshotSpanIndex([h(0.5, 0.5, 4)]);
    expect(index.sharesSpan(h(0.5, 99.5, 4))).toBe(false);
    expect(index.sharesSpan(v(0.5, 0.5, 4))).toBe(false);
  });
});
