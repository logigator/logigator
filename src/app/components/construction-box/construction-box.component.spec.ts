import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';

import { ConstructionBoxComponent } from './construction-box.component';

describe('ConstructionBoxComponent', () => {
	let component: ConstructionBoxComponent;
	let fixture: ComponentFixture<ConstructionBoxComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [ ConstructionBoxComponent ]
		})
			.compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(ConstructionBoxComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
