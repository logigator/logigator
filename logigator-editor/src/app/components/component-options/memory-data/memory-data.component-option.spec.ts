import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { romMeta } from '@logigator/core';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { makeRom } from '../../../../testing/factories';
import { bytesToBase64 } from '../../../utils/packed-buffer';
import { romComponentConfig } from '../../component-types/rom/rom.config';

describe('MemoryDataComponentOption', () => {
  beforeEach(() => {
    configureTestBed();
  });

  afterEach(() => {
    const template = romComponentConfig.options;
    template.wordSize.value = romMeta.options.wordSize.default;
    template.addressSize.value = romMeta.options.addressSize.default;
  });

  it('counts the words holding a set bit, within the dimensions the ROM has now', () => {
    // LSB first: with 4-bit words, word 1 is 5 and word 4 is 3; with 24-bit
    // words both fall into word 0.
    const rom = makeRom(2, 4, bytesToBase64(new Uint8Array([0x50, 0, 0x03])));
    const data = rom.options.data;
    expect(data.nonZeroWords()).toBe(1);

    rom.options.addressSize.value = 3;
    expect(data.nonZeroWords()).toBe(2);

    rom.options.wordSize.value = 24;
    expect(data.nonZeroWords()).toBe(1);

    expect(makeRom(2, 4, '').options.data.nonZeroWords()).toBe(0);
    rom.destroy({ children: true });
  });

  it('sizes the config’s own memory from the config’s own options, which placing edits', () => {
    const template = romComponentConfig.options;
    template.wordSize.value = 8;
    template.addressSize.value = 5;
    expect(template.data.wordSize()).toBe(8);
    expect(template.data.wordCount()).toBe(32);

    // A ROM keeps reading its own sizes, not the config's.
    const rom = makeRom(3, 2);
    expect(rom.options.data.wordSize()).toBe(2);
    expect(rom.options.data.wordCount()).toBe(8);
    rom.destroy({ children: true });
  });
});
