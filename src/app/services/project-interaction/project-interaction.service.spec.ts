import { TestBed } from '@angular/core/testing';

import { ProjectInteractionService } from './project-interaction.service';

describe('ProjectInteractionService', () => {
	beforeEach(() => TestBed.configureTestingModule({}));

	it('should be created', () => {
		const service: ProjectInteractionService = TestBed.get(ProjectInteractionService);
		expect(service).toBeTruthy();
	});
});
