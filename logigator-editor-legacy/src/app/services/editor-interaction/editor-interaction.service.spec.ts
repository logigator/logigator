import { TestBed } from '@angular/core/testing';
import { EditorInteractionService } from './editor-interaction.service';

describe('EditorInteractionService', () => {
	beforeEach(() => TestBed.configureTestingModule({}));

	it('should be created', () => {
		const service: EditorInteractionService = TestBed.inject(
			EditorInteractionService
		);
		expect(service).toBeTruthy();
	});
});
