/* eslint-disable @typescript-eslint/no-empty-function */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ToastService as UiToastService } from '@logigator/ui';
import { TranslationService } from '../translation/translation.service';

import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEvent } from '../analytics/analytics.mapping';

import { ToastService } from './toast.service';
import { LoggingService } from './logging.service';

describe('ToastService', () => {
  let service: ToastService;
  let messageService: UiToastService;
  let logging: LoggingService;
  let analytics: AnalyticsService;

  beforeEach(() => {
    const translocoSpy = {
      translate: vi.fn().mockName('TranslocoService.translate')
    };
    translocoSpy.translate.mockImplementation((key: string) => key);

    TestBed.configureTestingModule({
      providers: [
        UiToastService,
        { provide: TranslationService, useValue: translocoSpy }
      ]
    });
    service = TestBed.inject(ToastService);
    messageService = TestBed.inject(UiToastService);
    logging = TestBed.inject(LoggingService);
    analytics = TestBed.inject(AnalyticsService);

    vi.spyOn(messageService, 'add');
    vi.spyOn(analytics, 'capture').mockImplementation(() => {});
    vi.spyOn(logging, 'error').mockImplementation(() => {});
    vi.spyOn(logging, 'warn').mockImplementation(() => {});
    vi.spyOn(logging, 'info').mockImplementation(() => {});
  });

  describe('error', () => {
    it('shows a danger toast with translated summary', () => {
      service.error('err-msg', 'MyContext');
      expect(messageService.add).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'danger',
          summary: 'logging.error',
          detail: 'err-msg'
        })
      );
    });

    it('mirrors the cause and context to the logging service', () => {
      const cause = new Error('boom');
      service.error('err-msg', 'MyContext', cause);
      expect(logging.error).toHaveBeenCalledWith(cause, 'MyContext');
    });

    it('falls back to the message when no cause is given', () => {
      service.error('err-msg', 'MyContext');
      expect(logging.error).toHaveBeenCalledWith('err-msg', 'MyContext');
    });

    it('reports the message and the cause identity to analytics', () => {
      service.error('err-msg', 'MyContext', new TypeError('boom'));
      expect(analytics.capture).toHaveBeenCalledWith(
        AnalyticsEvent.ErrorShown,
        { context: 'MyContext', message: 'err-msg', cause: 'TypeError: boom' }
      );
    });

    it('reduces a non-Error cause to its class name, never its contents', () => {
      class HttpErrorResponse {
        public readonly url = 'https://logigator.com/api/projects/secret';
      }
      service.error('err-msg', 'MyContext', new HttpErrorResponse());
      const [, properties] = vi.mocked(analytics.capture).mock.calls[0];
      // The bundler suffixes local class names, hence the prefix match.
      expect(properties?.['cause']).toMatch(/^HttpErrorResponse/);
      expect(properties?.['cause']).not.toContain('secret');
    });
  });

  describe('warn', () => {
    it('shows a warning toast with translated summary', () => {
      service.warn('warn-msg', 'MyContext');
      expect(messageService.add).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'warn',
          summary: 'logging.warn',
          detail: 'warn-msg'
        })
      );
    });

    it('mirrors the cause and context to the logging service', () => {
      service.warn('warn-msg', 'MyContext', 'raw detail');
      expect(logging.warn).toHaveBeenCalledWith('raw detail', 'MyContext');
    });
  });

  describe('success', () => {
    it('shows a success toast with translated summary', () => {
      service.success('success-msg', 'MyContext');
      expect(messageService.add).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'success',
          summary: 'logging.success',
          detail: 'success-msg'
        })
      );
    });

    it('mirrors the message and context to the logging service at info level', () => {
      service.success('success-msg', 'MyContext');
      expect(logging.info).toHaveBeenCalledWith('success-msg', 'MyContext');
    });
  });

  describe('info', () => {
    it('shows an info toast with translated summary', () => {
      service.info('info-msg', 'MyContext');
      expect(messageService.add).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'info',
          summary: 'logging.info',
          detail: 'info-msg'
        })
      );
    });

    it('mirrors the message and context to the logging service at info level', () => {
      service.info('info-msg', 'MyContext');
      expect(logging.info).toHaveBeenCalledWith('info-msg', 'MyContext');
    });
  });
});
