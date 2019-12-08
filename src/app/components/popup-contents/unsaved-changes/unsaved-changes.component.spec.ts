import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { UnsavedChangesComponent } from './unsaved-changes.component';

describe('UnsavedChangesComponent', () => {
	let component: UnsavedChangesComponent;
	let fixture: ComponentFixture<UnsavedChangesComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [ UnsavedChangesComponent ]
		})
			.compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(UnsavedChangesComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
