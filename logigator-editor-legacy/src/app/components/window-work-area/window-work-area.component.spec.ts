import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { WindowWorkAreaComponent } from './window-work-area.component';

describe('WindowWorkAreaComponent', () => {
	let component: WindowWorkAreaComponent;
	let fixture: ComponentFixture<WindowWorkAreaComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [WindowWorkAreaComponent]
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(WindowWorkAreaComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
