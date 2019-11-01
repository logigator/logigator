import { TestBed } from '@angular/core/testing';

import { ErrorHandlingService } from './error-handling.service';

describe('ErrorHandlingService', () => {
	beforeEach(() => TestBed.configureTestingModule({}));

	it('should be created', () => {
		const service: ErrorHandlingService = TestBed.get(ErrorHandlingService);
		expect(service).toBeTruthy();
	});
});
