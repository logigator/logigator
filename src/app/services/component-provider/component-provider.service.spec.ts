import { TestBed } from '@angular/core/testing';

import { ComponentProviderService } from './component-provider.service';

describe('ComponentProviderService', () => {
	beforeEach(() => TestBed.configureTestingModule({}));

	it('should be created', () => {
		const service: ComponentProviderService = TestBed.get(ComponentProviderService);
		expect(service).toBeTruthy();
	});
});
