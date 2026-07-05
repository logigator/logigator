/* eslint-disable @typescript-eslint/no-empty-function */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ToastService as UiToastService } from '@logigator/ui';
import { TranslocoService } from '@jsverse/transloco';

import { ToastService } from './toast.service';
import { LoggingService } from './logging.service';

describe('ToastService', () => {
  let service: ToastService;
  let messageService: UiToastService;
  let logging: LoggingService;

  beforeEach(() => {
    const translocoSpy = {
      translate: vi.fn().mockName('TranslocoService.translate')
    };
    translocoSpy.translate.mockImplementation((key: string) => key);

    TestBed.configureTestingModule({
      providers: [
        UiToastService,
        { provide: TranslocoService, useValue: translocoSpy }
      ]
    });
    service = TestBed.inject(ToastService);
    messageService = TestBed.inject(UiToastService);
    logging = TestBed.inject(LoggingService);

    vi.spyOn(messageService, 'add');
    vi.spyOn(logging, 'error').mockImplementation(() => {});
    vi.spyOn(logging, 'warn').mockImplementation(() => {});
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('error', () => {
    it('shows a danger toast with translated summary', () => {
      service.error('err-msg');
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
      service.error('err-msg', cause, 'MyContext');
      expect(logging.error).toHaveBeenCalledWith(cause, 'MyContext');
    });

    it('falls back to the message and default context when no cause is given', () => {
      service.error('err-msg');
      expect(logging.error).toHaveBeenCalledWith('err-msg', 'App');
    });
  });

  describe('warn', () => {
    it('shows a warning toast with translated summary', () => {
      service.warn('warn-msg');
      expect(messageService.add).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'warn',
          summary: 'logging.warn',
          detail: 'warn-msg'
        })
      );
    });

    it('mirrors the cause and context to the logging service', () => {
      service.warn('warn-msg', 'raw detail', 'MyContext');
      expect(logging.warn).toHaveBeenCalledWith('raw detail', 'MyContext');
    });
  });

  describe('success', () => {
    it('shows a success toast with translated summary', () => {
      service.success('success-msg');
      expect(messageService.add).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'success',
          summary: 'logging.success',
          detail: 'success-msg'
        })
      );
    });

    it('does not mirror to the logging service', () => {
      service.success('success-msg');
      expect(logging.error).not.toHaveBeenCalled();
      expect(logging.warn).not.toHaveBeenCalled();
    });
  });

  describe('info', () => {
    it('shows an info toast with translated summary', () => {
      service.info('info-msg');
      expect(messageService.add).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'info',
          summary: 'logging.info',
          detail: 'info-msg'
        })
      );
    });
  });
});
