import { TestBed } from '@angular/core/testing';

import { WorkerCommunicationWasmService } from './worker-communication-wasm.service';

describe('WorkerCommunicationService', () => {
	beforeEach(() => TestBed.configureTestingModule({}));

	it('should be created', () => {
		const service: WorkerCommunicationWasmService = TestBed.inject(
			WorkerCommunicationWasmService
		);
		expect(service).toBeTruthy();
	});
});
