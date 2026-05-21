import { TestBed } from '@angular/core/testing';

import { LoggingService } from './logging.service';

describe('LoggingService', () => {
	let service: LoggingService;

	beforeEach(() => {
		spyOn(console, 'error');
		spyOn(console, 'warn');
		spyOn(console, 'log');
		spyOn(console, 'info');
		spyOn(console, 'debug');

		TestBed.configureTestingModule({});
		service = TestBed.inject(LoggingService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	describe('error', () => {
		it('passes the context and message to console.error', () => {
			service.error('err-msg', 'err-ctx');
			expect(console.error).toHaveBeenCalledWith('[%s] %o', 'err-ctx', 'err-msg');
		});
	});

	describe('warn', () => {
		it('passes the context and message to console.warn', () => {
			service.warn('warn-msg', 'warn-ctx');
			expect(console.warn).toHaveBeenCalledWith('[%s] %o', 'warn-ctx', 'warn-msg');
		});
	});

	describe('log', () => {
		it('passes the context and message to console.log', () => {
			service.log('log-msg', 'log-ctx');
			expect(console.log).toHaveBeenCalledWith('[%s] %o', 'log-ctx', 'log-msg');
		});
	});

	describe('info', () => {
		it('passes the context and message to console.info', () => {
			service.info('info-msg', 'info-ctx');
			expect(console.info).toHaveBeenCalledWith('[%s] %o', 'info-ctx', 'info-msg');
		});
	});

	describe('debug', () => {
		it('passes the context and message to console.debug', () => {
			service.debug('debug-msg', 'debug-ctx');
			expect(console.debug).toHaveBeenCalledWith(
				'[%s] %o',
				'debug-ctx',
				'debug-msg'
			);
		});
	});
});
