import { Component, input, model, output } from '@angular/core';
import { NameMap } from '@logigator/core';
import { describe, expect, it } from 'vitest';
import { NameMapComponentOption } from './name-map.component-option';
import { NameMapEditor } from './name-map-editor';

const LABEL = 'components.def.GAMEPAD.options.names';
const KEYS = ['up', 'down', 'a', 'b'];

@Component({ selector: 'app-test-names-editor', template: '' })
class TestNamesEditor implements NameMapEditor {
  public readonly keys = input.required<readonly string[]>();
  public readonly names = model.required<NameMap>();
  public readonly maxLength = input.required<number>();
  public readonly save = output<void>();
}

function makeOption(value: NameMap = {}): NameMapComponentOption {
  return new NameMapComponentOption(LABEL, KEYS, value, {
    maxLength: 4,
    forbiddenChars: /,/g
  });
}

describe('NameMapComponentOption', () => {
  it('stores every write sanitized and canonical', () => {
    const option = makeOption();
    option.value = {
      b: ' F,ire ',
      up: 'Forwards',
      down: '   ',
      left: 'X'
    } as NameMap;
    // Commas stripped, trimmed, clamped to 4, the blank and the unknown key
    // dropped, keys in schema order.
    expect(option.value).toEqual({ up: 'Forw', b: 'Fire' });
    expect(Object.keys(option.value)).toEqual(['up', 'b']);
  });

  it('sanitizes the constructor value too', () => {
    expect(makeOption({ a: 'a,b,c', down: '' }).value).toEqual({ a: 'abc' });
  });

  it('replaces its frozen value on every write rather than mutating it', () => {
    const option = makeOption({ a: 'Jump' });
    const before = option.value;
    expect(Object.isFrozen(before)).toBe(true);
    option.value = { a: 'Jump', b: 'Run' };
    expect(before).toEqual({ a: 'Jump' });
    expect(option.value).not.toBe(before);
  });

  it('gives a clone its own value object', () => {
    const option = makeOption({ a: 'Jump' });
    const cloned = option.clone();
    expect(cloned.value).toEqual(option.value);
    expect(cloned.value).not.toBe(option.value);
    expect(Object.isFrozen(cloned.value)).toBe(true);
  });

  it('carries its attachments into a clone', () => {
    const option = makeOption()
      .attachKeys(() => ['up', 'a'])
      .attachEditor(TestNamesEditor);
    const cloned = option.clone({ b: 'Run' });
    expect(cloned.editor).toBe(TestNamesEditor);
    expect(cloned.visibleKeys()).toEqual(['up', 'a']);
  });

  it('keeps names of keys the owner does not list', () => {
    const option = makeOption().attachKeys(() => ['up', 'down']);
    option.value = { up: 'Jump', a: 'Fire' };
    expect(option.value).toEqual({ up: 'Jump', a: 'Fire' });
  });

  it('treats a map equal by value as current, whatever its spelling', () => {
    const option = makeOption({ up: 'Jump', b: 'Fire' });
    expect(option.isCurrent({ b: ' Fire', up: 'Jump', a: '' })).toBe(true);
    expect(option.isCurrent({ up: 'Jump' })).toBe(false);
    expect(option.isCurrent({ up: 'Jump', b: 'Run' })).toBe(false);
  });
});
