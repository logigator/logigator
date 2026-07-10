import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';

import { GlobalErrorHandler } from './global-error-handler';
import { LoggingService } from './logging.service';
import { ToastService } from './toast.service';
import { BugReportService } from '../bug-report/bug-report.service';

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
        { provide: TranslocoService, useValue: translocoSpy },
        // Force the report service unavailable so these cover the early-boot
        // fallback (toast) path; the delegation path is covered below.
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
    let handlerWithReport: GlobalErrorHandler;
    let toastWithReport: { error: Mock };

    beforeEach(() => {
      TestBed.resetTestingModule();
      bugReport = { handleUncaughtError: vi.fn() };
      toastWithReport = { error: vi.fn() };
      TestBed.configureTestingModule({
        providers: [
          GlobalErrorHandler,
          { provide: LoggingService, useValue: { error: vi.fn() } },
          { provide: ToastService, useValue: toastWithReport },
          {
            provide: TranslocoService,
            useValue: { translate: (k: string) => k }
          },
          { provide: BugReportService, useValue: bugReport }
        ]
      });
      handlerWithReport = TestBed.inject(GlobalErrorHandler);
    });

    it('opens the report dialog for the error instead of toasting', () => {
      const err = new Error('boom');
      handlerWithReport.handleError(err);
      expect(bugReport.handleUncaughtError).toHaveBeenCalledWith(err);
      expect(toastWithReport.error).not.toHaveBeenCalled();
    });
  });
});
