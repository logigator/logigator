import { describe, expect, it } from 'vitest';
import { ConnectedPosition } from '@angular/cdk/overlay';
import {
  caretOffsetFor,
  connectedPositions,
  positionForSide,
  sideOfPosition
} from './overlay';

describe('connectedPositions', () => {
  it('orders preferred → opposite → perpendicular', () => {
    const positions = connectedPositions('bottom');
    expect(positions).toHaveLength(4);
    expect(positions[0]).toMatchObject({ originY: 'bottom', overlayY: 'top' });
    expect(positions[1]).toMatchObject({ originY: 'top', overlayY: 'bottom' });
    expect(positions[2].overlayX).toBe('start');
    expect(positions[3].overlayX).toBe('end');
  });

  // The caret reads the resolved position back through sideOfPosition, so a
  // single fixed position must still name the side it was built for.
  it.each(['top', 'bottom', 'left', 'right'] as const)(
    'round-trips the %s side',
    (side) => {
      expect(sideOfPosition(positionForSide(side))).toBe(side);
    }
  );

  it('applies the gap as an offset away from the anchor', () => {
    expect(connectedPositions('bottom', 12)[0].offsetY).toBe(12);
    expect(connectedPositions('top', 12)[0].offsetY).toBe(-12);
    expect(connectedPositions('right', 12)[0].offsetX).toBe(12);
    expect(connectedPositions('left', 12)[0].offsetX).toBe(-12);
  });
});

describe('caretOffsetFor', () => {
  const rect = (x: number, y: number, w: number, h: number) =>
    new DOMRect(x, y, w, h);
  // A 320x120 panel centred at x=200, y=300.
  const panel = rect(40, 240, 320, 120);

  it('is zero while the panel straddles the anchor', () => {
    expect(caretOffsetFor(rect(180, 400, 40, 40), panel, 'top')).toBe(0);
    expect(caretOffsetFor(rect(400, 280, 40, 40), panel, 'right')).toBe(0);
  });

  it('follows the anchor off the panel centre, on the edge in play', () => {
    // Anchor centre 60px left of the panel's: the caret trails it.
    expect(caretOffsetFor(rect(120, 400, 40, 40), panel, 'top')).toBe(-60);
    // A vertical edge reads the same anchor's Y offset instead, not its X.
    expect(caretOffsetFor(rect(120, 310, 40, 40), panel, 'right')).toBe(30);
  });

  it('stops short of the panel corners', () => {
    // Capped at half the edge less the caret's inset, never past the corner
    // where the panel stops being straight.
    const offset = caretOffsetFor(rect(2000, 400, 40, 40), panel, 'bottom');
    expect(offset).toBe(320 / 2 - 16);
    // The short edge caps sooner than the long one.
    expect(caretOffsetFor(rect(2000, 4000, 40, 40), panel, 'left')).toBe(
      120 / 2 - 16
    );
  });
});

describe('sideOfPosition', () => {
  const cases: [ConnectedPosition, string][] = [
    [
      {
        originX: 'center',
        originY: 'bottom',
        overlayX: 'center',
        overlayY: 'top'
      },
      'bottom'
    ],
    [
      {
        originX: 'center',
        originY: 'top',
        overlayX: 'center',
        overlayY: 'bottom'
      },
      'top'
    ],
    [
      {
        originX: 'end',
        originY: 'center',
        overlayX: 'start',
        overlayY: 'center'
      },
      'right'
    ],
    [
      {
        originX: 'start',
        originY: 'center',
        overlayX: 'end',
        overlayY: 'center'
      },
      'left'
    ]
  ];
  it.each(cases)('reads the resolved side back', (position, side) => {
    expect(sideOfPosition(position)).toBe(side);
  });
});
