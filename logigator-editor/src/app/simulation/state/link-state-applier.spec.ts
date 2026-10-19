import { describe, expect, it, vi, Mock } from 'vitest';
import { Component } from '../../components/component';
import { ConnectionPoint } from '../../connection-points/connection-point';
import { Wire } from '../../wires/wire';
import { LinkRenderTargets } from '../compiler/compiled-board.model';
import { LinkStateApplier } from './link-state-applier';

interface WireStub {
  setPowered: Mock;
  setConflict: Mock;
}

interface ComponentStub {
  setPortPowered: Mock;
  setPortConflict: Mock;
}

function stubWire(): WireStub {
  return { setPowered: vi.fn(), setConflict: vi.fn() };
}

function stubComponent(): ComponentStub {
  return { setPortPowered: vi.fn(), setPortConflict: vi.fn() };
}

function target(
  wires: WireStub[],
  ports: { component: ComponentStub; portIndex: number }[] = [],
  junctions: { setConflict: Mock }[] = []
): LinkRenderTargets {
  return {
    wires: wires as unknown as Wire[],
    ports: ports as unknown as { component: Component; portIndex: number }[],
    junctions: junctions as unknown as ConnectionPoint[]
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

    // Values bit 0 → link 2 on, bit 1 → link 0 off.
    applier.setLink(0, true);
    applier.applyDelta(new Uint32Array([2, 0]), new Uint8Array([0b01]));

    expect(wires[2].setPowered).toHaveBeenLastCalledWith(true);
    expect(wires[0].setPowered).toHaveBeenLastCalledWith(false);
    expect(wires[1].setPowered).not.toHaveBeenCalled();
  });

  it('diffs full snapshots and only touches changed links', () => {
    const wires = Array.from({ length: 9 }, stubWire);
    const applier = new LinkStateApplier(wires.map((w) => target([w])));

    // Links 0 and 8 on: byte 0 bit 0, byte 1 bit 0.
    applier.applyFull(new Uint8Array([0b0000_0001, 0b0000_0001]));
    applier.applyFull(new Uint8Array([0b0000_1001, 0b0000_0000]));

    expect(wires[0].setPowered).toHaveBeenCalledExactlyOnceWith(true);
    expect(wires[3].setPowered).toHaveBeenCalledExactlyOnceWith(true);
    expect(wires[8].setPowered).toHaveBeenCalledTimes(2);
    expect(wires[8].setPowered).toHaveBeenLastCalledWith(false);
    expect(wires[1].setPowered).not.toHaveBeenCalled();
  });

  it('reports link power state', () => {
    const applier = new LinkStateApplier([target([stubWire()])]);

    expect(applier.isPowered(0)).toBe(false);
    applier.setLink(0, true);
    expect(applier.isPowered(0)).toBe(true);
    expect(applier.isPowered(99)).toBe(false);
  });

  it('flags changes on targeted links only, consumed per read', () => {
    const wire = stubWire();
    // Link 0 carries a target, link 1 is an empty sparse slot.
    const applier = new LinkStateApplier([target([wire]), target([])]);

    expect(applier.consumeChanged()).toBe(false);
    applier.setLink(1, true);
    expect(applier.consumeChanged()).toBe(false);
    applier.setLink(0, true);
    expect(applier.consumeChanged()).toBe(true);
    expect(applier.consumeChanged()).toBe(false);
    applier.setLink(0, true);
    expect(applier.consumeChanged()).toBe(false);
  });

  it('counts visible link flips only, cumulatively', () => {
    const wire = stubWire();
    // Link 0 carries a target, link 1 is an empty sparse slot.
    const applier = new LinkStateApplier([target([wire]), target([])]);

    expect(applier.switchedLinks).toBe(0);
    // An empty slot flips state but has no visual.
    applier.setLink(1, true);
    expect(applier.switchedLinks).toBe(0);
    applier.setLink(0, true);
    applier.setLink(0, false);
    applier.setLink(0, false);
    expect(applier.switchedLinks).toBe(2);
    // The denominator for the activity percentage.
    expect(applier.totalLinks).toBe(2);
  });

  it('resets every powered link to unpowered', () => {
    const wires = [stubWire(), stubWire()];
    const applier = new LinkStateApplier(wires.map((w) => target([w])));

    applier.setLink(1, true);
    applier.reset();

    expect(wires[1].setPowered).toHaveBeenLastCalledWith(false);
    expect(wires[0].setPowered).not.toHaveBeenCalled();
  });

  describe('conflicts', () => {
    it('touches exactly the links entering or leaving conflict', () => {
      const wires = Array.from({ length: 6 }, stubWire);
      const component = stubComponent();
      const junction = { setConflict: vi.fn() };
      const applier = new LinkStateApplier(
        wires.map((wire, link) =>
          link === 4
            ? target([wire], [{ component, portIndex: 2 }], [junction])
            : target([wire])
        )
      );

      applier.applyConflicts(new Uint32Array([1, 3]));
      applier.applyConflicts(new Uint32Array([3, 4]));
      applier.applyConflicts(new Uint32Array([3, 4]));

      expect(wires[1].setConflict.mock.calls).toEqual([[true], [false]]);
      expect(wires[3].setConflict).toHaveBeenCalledExactlyOnceWith(true);
      expect(wires[4].setConflict).toHaveBeenCalledExactlyOnceWith(true);
      expect(component.setPortConflict).toHaveBeenCalledExactlyOnceWith(
        2,
        true
      );
      expect(junction.setConflict).toHaveBeenCalledExactlyOnceWith(true);
      for (const link of [0, 2, 5]) {
        expect(wires[link].setConflict).not.toHaveBeenCalled();
      }
      // Conflict is its own state: power is never touched.
      for (const wire of wires) {
        expect(wire.setPowered).not.toHaveBeenCalled();
      }
    });

    it('keeps its own copy of the set, so a recycled buffer cannot skew the diff', () => {
      const wires = Array.from({ length: 6 }, stubWire);
      const applier = new LinkStateApplier(wires.map((w) => target([w])));
      const ids = new Uint32Array([2]);

      applier.applyConflicts(ids);
      // The bridge hands the snapshot buffer back to the worker's pool.
      ids[0] = 5;
      applier.applyConflicts(new Uint32Array(0));

      expect(wires[2].setConflict.mock.calls).toEqual([[true], [false]]);
      expect(wires[5].setConflict).not.toHaveBeenCalled();
    });

    it('flags and counts only links with something to tint', () => {
      const wire = stubWire();
      // Link 0 is an empty sparse slot, link 1 carries a wire.
      const applier = new LinkStateApplier([target([]), target([wire])]);

      applier.applyConflicts(new Uint32Array([0]));
      expect(applier.consumeChanged()).toBe(false);
      expect(applier.hasShownConflict).toBe(false);

      applier.applyConflicts(new Uint32Array([0, 1]));
      expect(applier.consumeChanged()).toBe(true);
      expect(applier.hasShownConflict).toBe(true);

      applier.applyConflicts(new Uint32Array([0]));
      expect(applier.consumeChanged()).toBe(true);
      expect(applier.hasShownConflict).toBe(false);
    });

    it('clears every conflict on reset, and starts the next set from none', () => {
      const wires = [stubWire(), stubWire()];
      const applier = new LinkStateApplier(wires.map((w) => target([w])));

      applier.applyConflicts(new Uint32Array([1]));
      applier.reset();
      expect(wires[1].setConflict).toHaveBeenLastCalledWith(false);
      expect(applier.hasShownConflict).toBe(false);

      applier.applyConflicts(new Uint32Array([1]));
      expect(wires[1].setConflict).toHaveBeenLastCalledWith(true);
      expect(wires[0].setConflict).not.toHaveBeenCalled();
    });
  });
});
