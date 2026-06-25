import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { HexEditorComponent } from './hex-editor.component';

/**
 * Exercises the editor's grid model directly (no dialog render): seed via the
 * inputs, run the open-time reset, then drive the cell/save logic. The bit
 * packing itself is covered by packed-buffer.spec.
 */
describe('HexEditorComponent', () => {
  let fixture: ComponentFixture<HexEditorComponent>;
  // Reaches the component's protected grid model for assertions.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let comp: any;

  function seed(
    wordCount: number,
    wordSize: number,
    data = new Uint8Array(0)
  ): void {
    fixture.componentRef.setInput('wordCount', wordCount);
    fixture.componentRef.setInput('wordSize', wordSize);
    fixture.componentRef.setInput('data', data);
    comp.reset();
  }

  beforeEach(() => {
    configureTestBed();
    fixture = TestBed.createComponent(HexEditorComponent);
    comp = fixture.componentInstance;
  });

  it('derives grid dimensions from word count and size', () => {
    seed(4, 4); // 4 words × 4 bits = 2 bytes
    expect(comp.byteCount()).toBe(2);
    expect(comp.cellDigits()).toBe(1); // 4 bits → 1 hex digit
    expect(comp.cellCount()).toBe(4); // word view

    comp.view.set('byte');
    expect(comp.cellCount()).toBe(2);
    expect(comp.cellDigits()).toBe(2);
  });

  it('edits a word and emits the full buffer on save', () => {
    seed(4, 4);
    comp.onCellInput(1, 'a'); // word 1 = 0xA, occupies bits 4..7

    expect(comp.cellValue(1)).toBe('A');

    let saved: Uint8Array | undefined;
    fixture.componentInstance.saved.subscribe((v: Uint8Array) => (saved = v));
    comp.commit();

    // The editor emits the full table-sized buffer; trimming is the caller's job.
    expect(Array.from(saved!)).toEqual([0xa0, 0x00]);
  });

  it('clamps a word to the word-size maximum', () => {
    seed(2, 4);
    comp.onCellInput(0, 'ff'); // 0xFF clamped to 0xF for a 4-bit word
    expect(comp.cellValue(0)).toBe('F');
  });

  it('blocks non-hex characters before they are inserted', () => {
    const blocked = {
      data: 'z',
      preventDefault: vi.fn()
    } as unknown as InputEvent;
    comp.onCellBeforeInput(blocked);
    expect(blocked.preventDefault).toHaveBeenCalled();

    const allowed = {
      data: 'a',
      preventDefault: vi.fn()
    } as unknown as InputEvent;
    comp.onCellBeforeInput(allowed);
    expect(allowed.preventDefault).not.toHaveBeenCalled();
  });

  it('rewrites the field to the canonical value on commit', () => {
    seed(4, 4, Uint8Array.from([0x05])); // word 0 = 5
    // Invalid text parses to 0; the field must not keep showing the raw input.
    const invalid = { value: 'ZZ' } as HTMLInputElement;
    comp.onCellCommit(0, invalid);
    expect(comp.cellValue(0)).toBe('0');
    expect(invalid.value).toBe('0');

    // An over-max value is clamped and the field reflects the clamp.
    const tooBig = { value: 'FF' } as HTMLInputElement; // > 0xF for a 4-bit word
    comp.onCellCommit(1, tooBig);
    expect(tooBig.value).toBe('F');
  });

  it('clears all contents', () => {
    seed(4, 4, Uint8Array.from([0xff, 0xff]));
    expect(comp.cellValue(0)).toBe('F');
    comp.clear();
    expect(Array.from(comp.buffer())).toEqual([0, 0]);
  });

  it('flags the go-to field invalid only on a non-hex character', () => {
    seed(16, 4);
    expect(comp.gotoInvalid()).toBe(false); // empty
    comp.gotoInput.set('1a');
    expect(comp.gotoInvalid()).toBe(false);
    comp.gotoInput.set('1g');
    expect(comp.gotoInvalid()).toBe(true);
  });

  function paste(text: string): ClipboardEvent {
    return {
      clipboardData: { getData: () => text },
      preventDefault: vi.fn()
    } as unknown as ClipboardEvent;
  }

  it('spills a space-separated hex paste across consecutive cells', () => {
    seed(16, 4); // 4-bit words
    const event = paste('1 2 a');
    comp.onCellPaste(2, event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(comp.cellValue(2)).toBe('1');
    expect(comp.cellValue(3)).toBe('2');
    expect(comp.cellValue(4)).toBe('A');
    expect(comp.cellValue(5)).toBe('0'); // untouched
  });

  it('chunks an unbroken hex run by the cell digit width on paste', () => {
    seed(16, 8); // byte view via word size 8 → 2 digits per cell
    comp.onCellPaste(0, paste('DEADBEEF'));
    expect(comp.cellValue(0)).toBe('DE');
    expect(comp.cellValue(1)).toBe('AD');
    expect(comp.cellValue(2)).toBe('BE');
    expect(comp.cellValue(3)).toBe('EF');
  });

  it('serializes the buffer to a dump for copy-all', () => {
    seed(16, 8, Uint8Array.from([0x01, 0x02, 0xff]));
    const line = comp.dump().split('\n')[0];
    expect(line.startsWith('01 02 FF 00')).toBe(true);
  });

  it('reads contents seeded from a buffer', () => {
    // 0x81 = word0 bit0 (value 1), word1 bit3 (value 8) for a 4-bit word.
    seed(2, 4, Uint8Array.from([0x81]));
    expect(comp.cellValue(0)).toBe('1');
    expect(comp.cellValue(1)).toBe('8');
  });

  it('renders and sizes cells per the selected radix', () => {
    seed(4, 8, Uint8Array.from([0xff])); // byte 0 = 255
    expect(comp.cellDigits()).toBe(2); // hex: 2 digits for 8 bits
    expect(comp.cellValue(0)).toBe('FF');

    comp.radix.set('octal');
    expect(comp.cellDigits()).toBe(3); // ceil(8/3)
    expect(comp.cellValue(0)).toBe('377');

    comp.radix.set('binary');
    expect(comp.cellDigits()).toBe(8); // 8 bits → 8 digits
    expect(comp.cellValue(0)).toBe('11111111');
  });

  it('parses, validates and pastes in the active radix', () => {
    seed(16, 8);
    comp.radix.set('binary');

    // A digit invalid in binary is blocked.
    const blocked = { data: '2', preventDefault: vi.fn() } as unknown as InputEvent;
    comp.onCellBeforeInput(blocked);
    expect(blocked.preventDefault).toHaveBeenCalled();

    comp.onCellInput(0, '101'); // binary 101 = 5
    expect(comp.cellValue(0)).toBe('00000101');

    comp.onCellPaste(1, paste('1010 0001')); // two binary words
    expect(comp.cellValue(1)).toBe('00001010');
    expect(comp.cellValue(2)).toBe('00000001');
  });

  it('reports the active cell address and value', () => {
    seed(16, 8, Uint8Array.from([0x00, 0xff]));
    expect(comp.active()).toBeNull(); // nothing focused yet

    comp.activeCell.set(1);
    expect(comp.active()).toEqual({
      address: '01',
      value: 'FF',
      decimal: '255'
    });

    // Value follows the active radix; address stays hex.
    comp.radix.set('binary');
    expect(comp.active().value).toBe('11111111');
    expect(comp.active().address).toBe('01');

    // An out-of-range index (e.g. after the table shrank) reads as none.
    comp.activeCell.set(9999);
    expect(comp.active()).toBeNull();
  });

  it('keeps addresses hex regardless of radix', () => {
    seed(16, 8);
    comp.radix.set('binary');
    // Row 1 starts at cell 16 → hex address "10", not binary.
    expect(comp.addressLabel(16)).toBe('10');
  });
});
