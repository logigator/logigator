import { describe, expect, it } from 'vitest';
import { detectBrowserSupport } from './browser-support';

/** Real user agents, so the parser is tested against what browsers send. */
const UA = {
  chrome119:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  chrome109:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
  edge120:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.91',
  opera105:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 OPR/105.0.0.0',
  samsung23:
    'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36',
  androidWebView:
    'Mozilla/5.0 (Linux; Android 13; SM-S918B Build/TP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/117.0.0.0 Mobile Safari/537.36',
  firefox140:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0',
  // The user agent from the reported simulation-worker failure.
  firefox109:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/109.0',
  safari17:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  safari16_3:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Safari/605.1.15',
  safari15_6_1:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6.1 Safari/605.1.15',
  iosSafari17:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
  iosChrome119:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/119.0.6045.109 Mobile/15E148 Safari/604.1',
  iosChromeOnOld16_1:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/119.0.6045.109 Mobile/15E148 Safari/604.1',
  iosFirefox:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/121.0 Mobile/15E148 Safari/605.1.15',
  ipadOldStyle:
    'Mozilla/5.0 (iPad; CPU OS 16_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Mobile/15E148 Safari/604.1',
  ie11: 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko',
  edgeLegacy:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/18.19041'
} as const;

describe('detectBrowserSupport', () => {
  it('attributes every Chromium skin to the Chrome version it carries', () => {
    // Edge, Opera and Samsung Internet add their own token but keep `Chrome/`
    // with the real engine version, so the skin never changes the verdict.
    for (const ua of [
      UA.chrome119,
      UA.edge120,
      UA.opera105,
      UA.samsung23,
      UA.androidWebView
    ]) {
      expect(detectBrowserSupport(ua)).toMatchObject({
        supported: true,
        family: 'chromium'
      });
    }
  });

  it('reports a Chromium release below the floor as outdated', () => {
    expect(detectBrowserSupport(UA.chrome109)).toMatchObject({
      supported: false,
      family: 'chromium',
      major: 109,
      reason: 'outdated'
    });
  });

  it('reports the Firefox release that could not start a module worker', () => {
    expect(detectBrowserSupport(UA.firefox109)).toMatchObject({
      supported: false,
      family: 'firefox',
      major: 109,
      reason: 'outdated'
    });
  });

  it('accepts current Firefox', () => {
    expect(detectBrowserSupport(UA.firefox140)).toMatchObject({
      supported: true,
      family: 'firefox',
      major: 140
    });
  });

  it('compares the Safari minor version, not the major alone', () => {
    // The floor is 16.4, so 16.3 is out and 17.4 is in.
    expect(detectBrowserSupport(UA.safari16_3)).toMatchObject({
      supported: false,
      family: 'safari',
      major: 16,
      minor: 3
    });
    expect(detectBrowserSupport(UA.safari17)).toMatchObject({
      supported: true,
      major: 17,
      minor: 4
    });
  });

  it('reads a three-part Safari version', () => {
    expect(detectBrowserSupport(UA.safari15_6_1)).toMatchObject({
      supported: false,
      family: 'safari',
      major: 15,
      minor: 6
    });
  });

  it('judges an iOS browser by the OS version, not its own', () => {
    // Chrome and Firefox on iOS run the system WebKit and report a version
    // naming their own shell, which says nothing about the engine.
    expect(detectBrowserSupport(UA.iosChrome119)).toMatchObject({
      supported: true,
      family: 'safari',
      major: 17,
      minor: 0
    });
    expect(detectBrowserSupport(UA.iosFirefox)).toMatchObject({
      supported: true,
      family: 'safari',
      major: 17
    });
    expect(detectBrowserSupport(UA.iosSafari17)).toMatchObject({
      supported: true,
      family: 'safari',
      major: 17,
      minor: 1
    });
  });

  it('rejects a current iOS browser shell on an out-of-range OS', () => {
    // The CriOS version is well past any floor; iOS 16.1 is what decides.
    expect(detectBrowserSupport(UA.iosChromeOnOld16_1)).toMatchObject({
      supported: false,
      family: 'safari',
      major: 16,
      minor: 1,
      reason: 'outdated'
    });
  });

  it('reads the older iPad user agent, which omits the device from the OS field', () => {
    expect(detectBrowserSupport(UA.ipadOldStyle)).toMatchObject({
      supported: false,
      family: 'safari',
      major: 16,
      minor: 3
    });
  });

  it('treats an engine it cannot name as unsupported', () => {
    for (const ua of [UA.ie11, UA.edgeLegacy, '', 'CustomBot/1.0']) {
      expect(detectBrowserSupport(ua)).toEqual({
        supported: false,
        family: 'unknown',
        major: 0,
        minor: 0,
        reason: 'unrecognized'
      });
    }
  });
});
