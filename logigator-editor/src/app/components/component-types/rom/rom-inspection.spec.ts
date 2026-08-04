import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { makeRom } from '../../../../testing/factories';
import { bytesToBase64 } from '../../../utils/packed-buffer';
import { RomComponent } from './rom.component';
import { RomInspection } from './rom-inspection';
import { RomInspectionComponent } from './rom-inspection.component';

describe('RomInspection', () => {
  let rom: RomComponent;

  beforeEach(() => {
    configureTestBed();
    // 3 address bits → 8 words of 8 bits; bytes 0..2 hold 0x11 0x22 0x33.
    rom = makeRom(3, 8, bytesToBase64(Uint8Array.from([0x11, 0x22, 0x33])));
  });

  afterEach(() => {
    rom.destroy({ children: true });
  });

  it('decodes the contents blob to the full table size', () => {
    const inspection = new RomInspection(rom);
    expect(inspection.wordSize).toBe(8);
    expect(inspection.wordCount).toBe(8);
    expect(Array.from(inspection.bytes)).toEqual([
      0x11, 0x22, 0x33, 0, 0, 0, 0, 0
    ]);
    expect(inspection.renderer).toBe(RomInspectionComponent);
    expect(inspection.title()).toBeTruthy();
  });

  it('derives the address from input port power, LSB at port 0', () => {
    const inspection = new RomInspection(rom);
    expect(inspection.address()).toBe(0);

    // A1 (bit 0) and A2 (bit 1) powered → address 3.
    rom.setPortPowered(0, true);
    rom.setPortPowered(1, true);
    inspection.onFrame();
    expect(inspection.address()).toBe(3);

    rom.setPortPowered(0, false);
    rom.setPortPowered(1, true);
    inspection.onFrame();
    expect(inspection.address()).toBe(2);
  });

  it('ignores output port power when reading the address', () => {
    const inspection = new RomInspection(rom);
    // Ports 3.. are the outputs (O1..O8) — not address bits.
    rom.setPortPowered(3, true);
    rom.setPortPowered(5, true);
    inspection.onFrame();
    expect(inspection.address()).toBe(0);
  });

  it('seeds the address from the ports at construction', () => {
    rom.setPortPowered(2, true); // A3 → bit 2
    const inspection = new RomInspection(rom);
    expect(inspection.address()).toBe(4);
  });
});
