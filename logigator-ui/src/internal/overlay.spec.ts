import { describe, expect, it } from 'vitest';
import { ConnectedPosition } from '@angular/cdk/overlay';
import { connectedPositions, sideOfPosition } from './overlay';

describe('connectedPositions', () => {
  it('orders preferred → opposite → perpendicular', () => {
    const positions = connectedPositions('bottom');
    expect(positions).toHaveLength(4);
    // preferred: overlay sits below the origin
    expect(positions[0]).toMatchObject({ originY: 'bottom', overlayY: 'top' });
    // opposite second
    expect(positions[1]).toMatchObject({ originY: 'top', overlayY: 'bottom' });
    // then the perpendicular sides
    expect(positions[2].overlayX).toBe('start');
    expect(positions[3].overlayX).toBe('end');
  });

  it('applies the gap as an offset away from the anchor', () => {
    expect(connectedPositions('bottom', 12)[0].offsetY).toBe(12);
    expect(connectedPositions('top', 12)[0].offsetY).toBe(-12);
    expect(connectedPositions('right', 12)[0].offsetX).toBe(12);
    expect(connectedPositions('left', 12)[0].offsetX).toBe(-12);
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
