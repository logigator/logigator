import { beforeEach, describe, expect, it } from 'vitest';
import { BitmapText } from 'pixi.js';
import { SegmentBase } from '@logigator/core';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { makeSegmentDisplay } from '../../../../testing/factories';
import type { SegmentDisplayComponent } from './segment-display.component';

describe('SegmentDisplayComponent', () => {
  /** The rendered readout — the display's whole visible state. */
  function readout(display: SegmentDisplayComponent): string {
    const text = display.children
      .flatMap((child) => ('children' in child ? child.children : []))
      .find((child): child is BitmapText => child instanceof BitmapText);
    return text!.text;
  }

  beforeEach(() => {
    configureTestBed();
  });

  it('reads a negated input as the complement of its net', () => {
    const display = makeSegmentDisplay(4, SegmentBase.DEC);
    display.setPortNegated('in', 0, true);
    display.setPortNegated('in', 2, true);
    display.setSimulating(true);

    // Bits 0 and 2 read high off unpowered nets: 0b0101 = 5.
    expect(readout(display)).toBe('05');

    // Powering bit 0 clears it, leaving 0b0100 = 4.
    display.setPortPowered(0, true);
    expect(readout(display)).toBe('04');
    display.destroy({ children: true });
  });

  it('reads every input off its net outside a session', () => {
    const display = makeSegmentDisplay(4, SegmentBase.DEC);
    display.setPortNegated('in', 0, true);

    expect(readout(display)).toBe('00');
    display.destroy({ children: true });
  });
});
