import { TestBed } from '@angular/core/testing';

import { ProjectResolveService } from './project-resolve.service';

describe('ProjectResolveService', () => {
	beforeEach(() => TestBed.configureTestingModule({}));

	it('should be created', () => {
		const service: ProjectResolveService = TestBed.get(ProjectResolveService);
		expect(service).toBeTruthy();
	});
});
