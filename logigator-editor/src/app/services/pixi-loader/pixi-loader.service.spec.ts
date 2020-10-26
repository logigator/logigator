import {TestBed} from '@angular/core/testing';

import {PixiLoaderService} from './pixi-loader.service';

describe('PixiLoaderService', () => {
	let service: PixiLoaderService;

	beforeEach(() => {
		TestBed.configureTestingModule({});
		service = TestBed.inject(PixiLoaderService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});
});
