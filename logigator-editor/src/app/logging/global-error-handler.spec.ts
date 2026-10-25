import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslationService } from '../translation/translation.service';

import { GlobalErrorHandler } from './global-error-handler';
import { LoggingService } from './logging.service';
import { ToastService } from './toast.service';
import { BugReportService } from '../bug-report/bug-report.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { configureTestBed } from '../../testing/configure-test-bed';

describe('GlobalErrorHandler', () => {
  let handler: GlobalErrorHandler;
  let logging: LoggingService;
  let toast: ToastService;
  let now: number;

  beforeEach(() => {
    now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    const toastSpy = { error: vi.fn() };
    const loggingSpy = { error: vi.fn() };
    const translocoSpy = { translate: vi.fn((key: string) => key) };

    TestBed.configureTestingModule({
      providers: [
        GlobalErrorHandler,
        { provide: LoggingService, useValue: loggingSpy },
        { provide: ToastService, useValue: toastSpy },
        { provide: TranslationService, useValue: translocoSpy },
        // Report service forced unavailable, covering the early-boot toast
        // fallback; delegation is covered below.
        { provide: BugReportService, useValue: null }
      ]
    });
    handler = TestBed.inject(GlobalErrorHandler);
    logging = TestBed.inject(LoggingService);
    toast = TestBed.inject(ToastService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs every error with full detail', () => {
    const err = new Error('boom');
    handler.handleError(err);
    now += 10;
    handler.handleError(err);
    expect(logging.error).toHaveBeenCalledTimes(2);
    expect(logging.error).toHaveBeenCalledWith(err, 'GlobalErrorHandler');
  });

  it('throttles repeated toasts within the cooldown window', () => {
    handler.handleError(new Error('a'));
    now += 100;
    handler.handleError(new Error('b'));
    now += 100;
    handler.handleError(new Error('c'));
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith(
      'logging.unexpectedError',
      'GlobalErrorHandler'
    );
  });

  it('toasts again once the cooldown has elapsed', () => {
    handler.handleError(new Error('a'));
    now += 6000;
    handler.handleError(new Error('b'));
    expect(toast.error).toHaveBeenCalledTimes(2);
  });

  describe('with the bug-report service available', () => {
    let bugReport: { handleUncaughtError: Mock };
    let analytics: { captureError: Mock };
    let handlerWithReport: GlobalErrorHandler;
    let toastWithReport: { error: Mock };

    beforeEach(() => {
      TestBed.resetTestingModule();
      bugReport = { handleUncaughtError: vi.fn() };
      analytics = { captureError: vi.fn() };
      toastWithReport = { error: vi.fn() };
      TestBed.configureTestingModule({
        providers: [
          GlobalErrorHandler,
          { provide: LoggingService, useValue: { error: vi.fn() } },
          { provide: ToastService, useValue: toastWithReport },
          {
            provide: TranslationService,
            useValue: { translate: (k: string) => k }
          },
          { provide: BugReportService, useValue: bugReport },
          { provide: AnalyticsService, useValue: analytics }
        ]
      });
      handlerWithReport = TestBed.inject(GlobalErrorHandler);
    });

    it('opens the report dialog for the error instead of toasting', () => {
      const err = new Error('boom');
      handlerWithReport.handleError(err);
      expect(bugReport.handleUncaughtError).toHaveBeenCalledWith(
        err,
        expect.any(String)
      );
      expect(toastWithReport.error).not.toHaveBeenCalled();
    });

    it('hands the same correlation id to analytics and the bug report', () => {
      const err = new Error('boom');
      handlerWithReport.handleError(err);
      const [, analyticsId] = analytics.captureError.mock.calls[0];
      const [, reportId] = bugReport.handleUncaughtError.mock.calls[0];
      expect(analyticsId).toBe(reportId);

      // A second error gets a fresh id: ids correlate one error's sinks, not
      // the session.
      handlerWithReport.handleError(new Error('again'));
      const [, secondId] = bugReport.handleUncaughtError.mock.calls[1];
      expect(secondId).not.toBe(reportId);
    });
  });
});

/**
 * The editor is zoneless with `"polyfills": []`, so nothing patches
 * `addEventListener`: a throw inside `PointerController`'s raw canvas
 * listeners, a PixiJS ticker callback or a floated promise crosses no
 * Angular-managed boundary. `provideBrowserGlobalErrorListeners()` in
 * `appConfig` is the only thing that carries those into `ErrorHandler`, so
 * these drive the real provider set through `configureTestBed` — dropping the
 * provider is exactly what has to fail here.
 */
describe('the window listeners appConfig installs', () => {
  let bugReport: { handleUncaughtError: Mock };

  beforeEach(() => {
    TestBed.resetTestingModule();
    bugReport = { handleUncaughtError: vi.fn() };
    configureTestBed([
      { provide: BugReportService, useValue: bugReport },
      { provide: LoggingService, useValue: { error: vi.fn() } }
    ]);
  });

  it('reports an exception thrown outside Angular', () => {
    const error = new RangeError('Maximum call stack size exceeded');

    window.dispatchEvent(
      // Cancelable, as the browser's own is: the listener calls
      // `preventDefault()`, which is what keeps a reported error from also
      // reaching the console.
      new ErrorEvent('error', {
        error,
        message: error.message,
        cancelable: true
      })
    );

    expect(bugReport.handleUncaughtError).toHaveBeenCalledWith(
      error,
      expect.any(String)
    );
  });

  it('reports the reason of a rejection nothing handled', () => {
    const reason = new Error('the floated promise rejected');
    const event = new Event('unhandledrejection', { cancelable: true });
    // jsdom has no `PromiseRejectionEvent`; the listener reads `reason` off
    // whatever the event is.
    Object.defineProperty(event, 'reason', { value: reason });

    window.dispatchEvent(event);

    expect(bugReport.handleUncaughtError).toHaveBeenCalledWith(
      reason,
      expect.any(String)
    );
  });
});
