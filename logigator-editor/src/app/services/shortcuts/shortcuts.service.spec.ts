import {TestBed} from '@angular/core/testing';
import {ShortcutsService} from './shortcuts.service';


describe('ShortcutsService', () => {
	let service: ShortcutsService;

	beforeEach(() => {
		TestBed.configureTestingModule({});
		service = TestBed.inject(ShortcutsService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});
});
