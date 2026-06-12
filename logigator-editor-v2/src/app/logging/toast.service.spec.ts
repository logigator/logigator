import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { TranslocoService } from '@jsverse/transloco';

import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;
  let messageService: MessageService;

  beforeEach(() => {
    vi.spyOn(console, 'error');
    vi.spyOn(console, 'warn');
    vi.spyOn(console, 'log');
    vi.spyOn(console, 'info');
    vi.spyOn(console, 'debug');

    const translocoSpy = {
      translate: vi.fn().mockName('TranslocoService.translate')
    };
    translocoSpy.translate.mockImplementation((key: string) => key);

    TestBed.configureTestingModule({
      providers: [
        MessageService,
        { provide: TranslocoService, useValue: translocoSpy }
      ]
    });
    service = TestBed.inject(ToastService);
    messageService = TestBed.inject(MessageService);

    vi.spyOn(messageService, 'add');
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
