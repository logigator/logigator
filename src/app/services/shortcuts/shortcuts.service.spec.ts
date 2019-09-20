import { TestBed } from '@angular/core/testing';

import { ShortcutsService } from './shortcuts.service';

describe('ShortcutsService', () => {
	beforeEach(() => TestBed.configureTestingModule({}));

	it('should be created', () => {
		const service: ShortcutsService = TestBed.get(ShortcutsService);
		expect(service).toBeTruthy();
	});
});
