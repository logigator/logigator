import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { InputErrorComponent } from './input-error.component';

describe('InputErrorComponent', () => {
	let component: InputErrorComponent;
	let fixture: ComponentFixture<InputErrorComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [InputErrorComponent]
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(InputErrorComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
