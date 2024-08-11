import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ComponentListComponent } from './component-list.component';

describe('ComponentListComponent', () => {
	let component: ComponentListComponent;
	let fixture: ComponentFixture<ComponentListComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [ComponentListComponent]
		}).compileComponents();

		fixture = TestBed.createComponent(ComponentListComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
