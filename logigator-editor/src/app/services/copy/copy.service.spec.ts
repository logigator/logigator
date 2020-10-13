import { TestBed } from '@angular/core/testing';

import { CopyService } from './copy.service';

describe('CopyService', () => {
	beforeEach(() => TestBed.configureTestingModule({}));

	it('should be created', () => {
		const service: CopyService = TestBed.inject(CopyService);
		expect(service).toBeTruthy();
	});
});
