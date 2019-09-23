import { TestBed } from '@angular/core/testing';

import { ProjectSaveManagementService } from './project-save-management.service';

describe('ProjectSaveManagementService', () => {
	beforeEach(() => TestBed.configureTestingModule({}));

	it('should be created', () => {
		const service: ProjectSaveManagementService = TestBed.get(ProjectSaveManagementService);
		expect(service).toBeTruthy();
	});
});
