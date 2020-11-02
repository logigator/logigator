import { TestBed } from '@angular/core/testing';

import { FileSaverService } from './file-saver.service';

describe('FileSaverService', () => {
	let service: FileSaverService;

	beforeEach(() => {
		TestBed.configureTestingModule({});
		service = TestBed.inject(FileSaverService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});
});
