import { TestBed } from '@angular/core/testing';

import { RenderTicker } from './render-ticker.service';

describe('RenderTickerService', () => {
	beforeEach(() => TestBed.configureTestingModule({}));

	it('should be created', () => {
		const service: RenderTicker = TestBed.inject(RenderTicker);
		expect(service).toBeTruthy();
	});
});
