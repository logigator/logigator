import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AllWorkAreasComponent } from './all-work-areas.component';

describe('AllWorkAreasComponent', () => {
	let component: AllWorkAreasComponent;
	let fixture: ComponentFixture<AllWorkAreasComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [ AllWorkAreasComponent ]
		})
			.compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(AllWorkAreasComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
