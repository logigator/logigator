import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ConstructionBoxCategoryComponent } from './construction-box-category.component';

describe('ConstructionBoxCategoryComponent', () => {
	let component: ConstructionBoxCategoryComponent;
	let fixture: ComponentFixture<ConstructionBoxCategoryComponent>;

	beforeEach(async(() => {
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
