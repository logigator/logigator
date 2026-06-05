import { describe, beforeEach, it, expect, vi } from 'vitest';
import { TextInputComponentOption } from './text-input.component-option';

const LABEL = 'components.options.label';

describe('TextInputComponentOption', () => {
  it('defaults to an empty string', () => {
    expect(new TextInputComponentOption(LABEL).value).toBe('');
  });

  it('is unconstrained by default (no maxLength, no stripping)', () => {
    const option = new TextInputComponentOption(LABEL);
    option.value = 'a, very long, value';
    expect(option.value).toBe('a, very long, value');
  });

  it('clamps to a configured maxLength', () => {
    const option = new TextInputComponentOption(LABEL, '', { maxLength: 2 });
    option.value = 'abcdef';
    expect(option.value).toBe('ab');
  });

  it('strips configured forbidden characters', () => {
    const option = new TextInputComponentOption(LABEL, '', {
      forbiddenChars: /,/g
    });
    option.value = 'a,b,c';
    expect(option.value).toBe('abc');
  });

  it('applies stripping before clamping (the plug label config)', () => {
    const option = new TextInputComponentOption(LABEL, '', {
      maxLength: 5,
      forbiddenChars: /,/g
    });
    option.value = 'x,yzwvu';
    // commas removed first, then clamped to 5
    expect(option.value).toBe('xyzwv');
  });

  it('sanitizes the default value too', () => {
    const option = new TextInputComponentOption(LABEL, 'x,yzwvu', {
      maxLength: 5,
      forbiddenChars: /,/g
    });
    expect(option.value).toBe('xyzwv');
  });

  it('clones its value and constraints', () => {
    const option = new TextInputComponentOption(LABEL, 'A', {
      maxLength: 5,
      forbiddenChars: /,/g
    });
    const cloned = option.clone();
    expect(cloned.value).toBe('A');
    expect(option.clone('B').value).toBe('B');
    // constraints survive the clone
    cloned.value = 'p,qrstuv';
    expect(cloned.value).toBe('pqrst');
  });

  it('preserves inspectorHidden across clone', () => {
    const option = new TextInputComponentOption(LABEL).hideFromInspector();
    expect(option.inspectorHidden).toBe(true);
    expect(option.clone().inspectorHidden).toBe(true);
  });

  it('does not mark a normal option as inspectorHidden', () => {
    const option = new TextInputComponentOption(LABEL);
    expect(option.inspectorHidden).toBe(false);
    expect(option.clone().inspectorHidden).toBe(false);
  });
});
