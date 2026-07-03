import { describe, expect, it } from 'vitest';
import { LOGIGATOR_UI_VERSION } from './public-api';

describe('@logigator/ui', () => {
  it('exposes a version marker', () => {
    expect(LOGIGATOR_UI_VERSION).toBe('0.0.0');
  });
});
