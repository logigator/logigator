import { afterEach, describe, expect, it } from 'vitest';
import { isApplePlatform } from './platform';

describe('isApplePlatform', () => {
  const original = Object.getOwnPropertyDescriptor(
    Navigator.prototype,
    'platform'
  );
  const originalUAData = Object.getOwnPropertyDescriptor(
    Navigator.prototype,
    'userAgentData'
  );

  function setPlatform(platform: string, uaDataPlatform?: string): void {
    Object.defineProperty(navigator, 'platform', {
      value: platform,
      configurable: true
    });
    Object.defineProperty(navigator, 'userAgentData', {
      value:
        uaDataPlatform === undefined ? undefined : { platform: uaDataPlatform },
      configurable: true
    });
  }

  afterEach(() => {
    if (original) Object.defineProperty(navigator, 'platform', original);
    if (originalUAData) {
      Object.defineProperty(navigator, 'userAgentData', originalUAData);
    } else {
      delete (navigator as { userAgentData?: unknown }).userAgentData;
    }
  });

  it('recognizes the modern Apple platform strings', () => {
    // Chromium reports 'macOS' — lowercase, and the only value it ever gives.
    setPlatform('MacIntel', 'macOS');
    expect(isApplePlatform()).toBe(true);
  });

  it('recognizes the deprecated platform strings', () => {
    setPlatform('MacIntel');
    expect(isApplePlatform()).toBe(true);
    setPlatform('iPhone');
    expect(isApplePlatform()).toBe(true);
  });

  it('is false everywhere else', () => {
    setPlatform('Linux x86_64');
    expect(isApplePlatform()).toBe(false);
    setPlatform('Win32', 'Windows');
    expect(isApplePlatform()).toBe(false);
  });
});
