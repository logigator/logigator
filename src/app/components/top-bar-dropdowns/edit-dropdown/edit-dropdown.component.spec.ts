import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { EditDropdownComponent } from './edit-dropdown.component';

describe('EditDropdownComponent', () => {
	let component: EditDropdownComponent;
	let fixture: ComponentFixture<EditDropdownComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [ EditDropdownComponent ]
		})
			.compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(EditDropdownComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
