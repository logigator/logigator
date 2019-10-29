import { TestBed } from '@angular/core/testing';

import { WorkerCommunicationService } from './worker-communication.service';

describe('WorkerCommunicationService', () => {
	beforeEach(() => TestBed.configureTestingModule({}));

	it('should be created', () => {
		const service: WorkerCommunicationService = TestBed.get(WorkerCommunicationService);
		expect(service).toBeTruthy();
	});
});
