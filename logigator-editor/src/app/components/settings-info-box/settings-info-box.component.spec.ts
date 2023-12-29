import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { SettingsInfoBoxComponent } from './settings-info-box.component';

describe('SettingsInfoBoxComponent', () => {
	let component: SettingsInfoBoxComponent;
	let fixture: ComponentFixture<SettingsInfoBoxComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [SettingsInfoBoxComponent]
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(SettingsInfoBoxComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
