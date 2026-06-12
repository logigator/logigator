import { describe, expect, it, vi, Mock } from 'vitest';
import { Component } from '../../components/component';
import { Wire } from '../../wires/wire';
import { LinkRenderTargets } from '../compiler/compiled-board.model';
import { LinkStateApplier } from './link-state-applier';

interface WireStub {
  setPowered: Mock;
}

interface ComponentStub {
  setPortPowered: Mock;
}

function stubWire(): WireStub {
  return { setPowered: vi.fn() };
}

function stubComponent(): ComponentStub {
  return { setPortPowered: vi.fn() };
}

function target(
  wires: WireStub[],
  ports: { component: ComponentStub; portIndex: number }[] = []
): LinkRenderTargets {
  return {
    wires: wires as unknown as Wire[],
    ports: ports as unknown as { component: Component; portIndex: number }[]
  };
}

describe('LinkStateApplier', () => {
  it('powers all wires and port stubs of a link', () => {
    const wire = stubWire();
    const component = stubComponent();
    const applier = new LinkStateApplier([
      target([wire], [{ component, portIndex: 1 }])
    ]);

    applier.setLink(0, true);

    expect(wire.setPowered).toHaveBeenCalledExactlyOnceWith(true);
    expect(component.setPortPowered).toHaveBeenCalledExactlyOnceWith(1, true);
  });

  it('is idempotent per link state', () => {
    const wire = stubWire();
    const applier = new LinkStateApplier([target([wire])]);

    applier.setLink(0, true);
    applier.setLink(0, true);
    applier.setLink(0, false);
    applier.setLink(0, false);

    expect(wire.setPowered).toHaveBeenCalledTimes(2);
    expect(wire.setPowered).toHaveBeenNthCalledWith(1, true);
    expect(wire.setPowered).toHaveBeenNthCalledWith(2, false);
  });

  it('ignores out-of-range link ids', () => {
    const applier = new LinkStateApplier([target([stubWire()])]);

    expect(() => applier.setLink(7, true)).not.toThrow();
  });

  it('applies a delta snapshot (bit i ↔ ids[i])', () => {
    const wires = [stubWire(), stubWire(), stubWire()];
    const applier = new LinkStateApplier(wires.map((w) => target([w])));

    // Links 2 and 0 change; values bit 0 → link 2 on, bit 1 → link 0 off.
    applier.setLink(0, true);
    applier.applyDelta(new Uint32Array([2, 0]), new Uint8Array([0b01]));

    expect(wires[2].setPowered).toHaveBeenLastCalledWith(true);
    expect(wires[0].setPowered).toHaveBeenLastCalledWith(false);
    expect(wires[1].setPowered).not.toHaveBeenCalled();
  });

  it('diffs full snapshots and only touches changed links', () => {
    const wires = Array.from({ length: 9 }, stubWire);
    const applier = new LinkStateApplier(wires.map((w) => target([w])));

    // Links 0 and 8 on (byte 0 bit 0, byte 1 bit 0).
    applier.applyFull(new Uint8Array([0b0000_0001, 0b0000_0001]));
    // Link 0 stays on, link 8 turns off, link 3 turns on.
    applier.applyFull(new Uint8Array([0b0000_1001, 0b0000_0000]));

    expect(wires[0].setPowered).toHaveBeenCalledExactlyOnceWith(true);
    expect(wires[3].setPowered).toHaveBeenCalledExactlyOnceWith(true);
    expect(wires[8].setPowered).toHaveBeenCalledTimes(2);
    expect(wires[8].setPowered).toHaveBeenLastCalledWith(false);
    expect(wires[1].setPowered).not.toHaveBeenCalled();
  });

  it('resets every powered link to unpowered', () => {
    const wires = [stubWire(), stubWire()];
    const applier = new LinkStateApplier(wires.map((w) => target([w])));

    applier.setLink(1, true);
    applier.reset();

    expect(wires[1].setPowered).toHaveBeenLastCalledWith(false);
    // Never-powered links are untouched by reset.
    expect(wires[0].setPowered).not.toHaveBeenCalled();
  });
});
