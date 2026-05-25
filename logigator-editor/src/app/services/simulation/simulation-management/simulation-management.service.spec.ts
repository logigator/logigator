import { TestBed } from '@angular/core/testing';

import { SimulationManagementService } from './simulation-management.service';

describe('SimulationManagementService', () => {
	let service: SimulationManagementService;

	beforeEach(() => {
		TestBed.configureTestingModule({});
		service = TestBed.inject(SimulationManagementService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});
});
