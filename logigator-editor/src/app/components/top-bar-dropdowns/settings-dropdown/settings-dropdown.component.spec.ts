import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { SettingsDropdownComponent } from './settings-dropdown.component';

describe('SettingsDropdownComponent', () => {
	let component: SettingsDropdownComponent;
	let fixture: ComponentFixture<SettingsDropdownComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [SettingsDropdownComponent]
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(SettingsDropdownComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
