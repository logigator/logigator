import {waitForAsync, ComponentFixture, TestBed } from '@angular/core/testing';

import { UnsavedChangesComponent } from './unsaved-changes.component';

describe('UnsavedChangesComponent', () => {
	let component: UnsavedChangesComponent;
	let fixture: ComponentFixture<UnsavedChangesComponent>;

	beforeEach(waitForAsync(() => {
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
