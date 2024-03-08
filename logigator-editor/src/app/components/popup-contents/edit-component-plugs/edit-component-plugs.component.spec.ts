import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditComponentPlugsComponent } from './edit-component-plugs.component';

describe('EditComponentPlugsComponent', () => {
	let component: EditComponentPlugsComponent;
	let fixture: ComponentFixture<EditComponentPlugsComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [EditComponentPlugsComponent]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(EditComponentPlugsComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
