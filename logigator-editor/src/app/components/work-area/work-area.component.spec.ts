import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { WorkAreaComponent } from './work-area.component';

describe('WorkAreaComponent', () => {
	let component: WorkAreaComponent;
	let fixture: ComponentFixture<WorkAreaComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [WorkAreaComponent]
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(WorkAreaComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
