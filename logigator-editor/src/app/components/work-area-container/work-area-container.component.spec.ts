import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';

import { WorkAreaContainerComponent } from './work-area-container.component';

describe('WorkAreaContainerComponent', () => {
	let component: WorkAreaContainerComponent;
	let fixture: ComponentFixture<WorkAreaContainerComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [ WorkAreaContainerComponent ]
		})
			.compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(WorkAreaContainerComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
