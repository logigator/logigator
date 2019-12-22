import { TestBed } from '@angular/core/testing';

import { ImageExportService } from './image-export.service';

describe('ImageExportService', () => {
	beforeEach(() => TestBed.configureTestingModule({}));

	it('should be created', () => {
		const service: ImageExportService = TestBed.get(ImageExportService);
		expect(service).toBeTruthy();
	});
});
