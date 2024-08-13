import { TestBed } from '@angular/core/testing';

import { WorkModeService } from './work-mode.service';

describe('WorkModeService', () => {
	let service: WorkModeService;

	beforeEach(() => {
		TestBed.configureTestingModule({});
		service = TestBed.inject(WorkModeService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});
});
