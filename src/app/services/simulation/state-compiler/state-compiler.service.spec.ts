import { TestBed } from '@angular/core/testing';

import { StateCompilerService } from './state-compiler.service';

describe('StateCompilerService', () => {
	beforeEach(() => TestBed.configureTestingModule({}));

	it('should be created', () => {
		const service: StateCompilerService = TestBed.get(StateCompilerService);
		expect(service).toBeTruthy();
	});
});
