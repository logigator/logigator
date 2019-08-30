import { TestBed } from '@angular/core/testing';

import { WorkModeService } from './work-mode.service';

describe('WorkModeService', () => {
	beforeEach(() => TestBed.configureTestingModule({}));

	it('should be created', () => {
		const service: WorkModeService = TestBed.get(WorkModeService);
		expect(service).toBeTruthy();
	});
});
