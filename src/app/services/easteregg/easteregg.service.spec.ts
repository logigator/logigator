import { TestBed } from '@angular/core/testing';

import { EastereggService } from './easteregg.service';

describe('EastereggService', () => {
	beforeEach(() => TestBed.configureTestingModule({}));

	it('should be created', () => {
		const service: EastereggService = TestBed.get(EastereggService);
		expect(service).toBeTruthy();
	});
});
