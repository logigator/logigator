import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { TranslocoService } from '@jsverse/transloco';

import { ToastService } from './toast.service';

describe('ToastService', () => {
	let service: ToastService;
	let messageService: MessageService;

	beforeEach(() => {
		spyOn(console, 'error');
		spyOn(console, 'warn');
		spyOn(console, 'log');
		spyOn(console, 'info');
		spyOn(console, 'debug');

		const translocoSpy = jasmine.createSpyObj('TranslocoService', ['translate']);
		translocoSpy.translate.and.callFake((key: string) => key);

		TestBed.configureTestingModule({
			providers: [
				MessageService,
				{ provide: TranslocoService, useValue: translocoSpy }
			]
		});
		service = TestBed.inject(ToastService);
		messageService = TestBed.inject(MessageService);

		spyOn(messageService, 'add');
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	describe('error', () => {
		it('shows a danger toast with translated summary', () => {
			service.error('err-msg');
			expect(messageService.add).toHaveBeenCalledWith(
				jasmine.objectContaining({
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
				jasmine.objectContaining({
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
				jasmine.objectContaining({
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
				jasmine.objectContaining({
					severity: 'info',
					summary: 'logging.info',
					detail: 'info-msg'
				})
			);
		});
	});
});
