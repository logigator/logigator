import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { RomEditComponent } from './rom-edit.component';

describe('RomEditComponent', () => {
	let component: RomEditComponent;
	let fixture: ComponentFixture<RomEditComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [ RomEditComponent ]
		})
			.compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(RomEditComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
