import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { SettingsInfoBoxComponent } from './settings-info-box.component';

describe('SettingsInfoBoxComponent', () => {
	let component: SettingsInfoBoxComponent;
	let fixture: ComponentFixture<SettingsInfoBoxComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [ SettingsInfoBoxComponent ]
		})
			.compileComponents();
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
