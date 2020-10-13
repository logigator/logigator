import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';

import { ConstructionBoxCategoryComponent } from './construction-box-category.component';

describe('ConstructionBoxCategoryComponent', () => {
	let component: ConstructionBoxCategoryComponent;
	let fixture: ComponentFixture<ConstructionBoxCategoryComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [ ConstructionBoxCategoryComponent ]
		})
		.compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(ConstructionBoxCategoryComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
