import {TestBed} from '@angular/core/testing';
import {EditorActionsService} from './editor-actions.service';


describe('EditorActionsService', () => {
	let service: EditorActionsService;

	beforeEach(() => {
		TestBed.configureTestingModule({});
		service = TestBed.inject(EditorActionsService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});
});
