import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { SaveAsComponent } from './save-as.component';

describe('SaveAsComponent', () => {
	let component: SaveAsComponent;
	let fixture: ComponentFixture<SaveAsComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [ SaveAsComponent ]
		})
			.compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(SaveAsComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
