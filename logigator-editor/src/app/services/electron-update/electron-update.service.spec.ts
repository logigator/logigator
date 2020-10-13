import {TestBed} from '@angular/core/testing';

import {ElectronUpdateService} from './electron-update.service';

describe('ElectronUpdateService', () => {
	let service: ElectronUpdateService;

	beforeEach(() => {
		TestBed.configureTestingModule({});
		service = TestBed.inject(ElectronUpdateService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});
});
