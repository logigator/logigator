import { TestBed } from '@angular/core/testing';

import { ShortcutsService } from './shortcuts.service';

describe('ShortcutsService', () => {
	beforeEach(() => TestBed.configureTestingModule({}));

	it('should be created', () => {
		const service: ShortcutsService = TestBed.inject(ShortcutsService);
		expect(service).toBeTruthy();
	});
});
