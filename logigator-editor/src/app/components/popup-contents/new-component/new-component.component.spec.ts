import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { NewComponentComponent } from './new-component.component';

describe('NewComponentComponent', () => {
	let component: NewComponentComponent;
	let fixture: ComponentFixture<NewComponentComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [NewComponentComponent]
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(NewComponentComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
