import { TestBed } from '@angular/core/testing';

import { HelpWindowService } from './help-window.service';

describe('HelpWindowService', () => {
	let service: HelpWindowService;

	beforeEach(() => {
		TestBed.configureTestingModule({});
		service = TestBed.inject(HelpWindowService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});
});
