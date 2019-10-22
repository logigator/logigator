import { TestBed } from '@angular/core/testing';

import { SharingService } from './sharing.service';

describe('SharingService', () => {
	beforeEach(() => TestBed.configureTestingModule({}));

	it('should be created', () => {
		const service: SharingService = TestBed.get(SharingService);
		expect(service).toBeTruthy();
	});
});
