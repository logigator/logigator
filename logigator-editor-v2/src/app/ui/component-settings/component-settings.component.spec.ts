import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ComponentSettingsComponent } from './component-settings.component';
import { appConfig } from '../../app.config';

describe('ComponentSettingsComponent', () => {
	let component: ComponentSettingsComponent;
	let fixture: ComponentFixture<ComponentSettingsComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [ComponentSettingsComponent],
			providers: appConfig.providers
		}).compileComponents();

		fixture = TestBed.createComponent(ComponentSettingsComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
