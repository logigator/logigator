import { TestBed } from '@angular/core/testing';

import { ElementProviderService } from './element-provider.service';

describe('ElementProviderService', () => {
	beforeEach(() => TestBed.configureTestingModule({}));

	it('should be created', () => {
		const service: ElementProviderService = TestBed.inject(
			ElementProviderService
		);
		expect(service).toBeTruthy();
	});
});
