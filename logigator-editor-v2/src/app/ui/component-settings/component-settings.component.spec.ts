import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ComponentSettingsComponent } from './component-settings.component';
import { appConfig } from '../../app.config';
import { NumberComponentOption } from '../../components/component-options/number/number.component-option';

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

	it('omits inspector-hidden options from the rendered form', () => {
		// Mirror real usage: options reach the panel as clones (placement ghost /
		// deserialize), so the hidden flag must survive cloning.
		const visible = new NumberComponentOption(
			'components.options.inputs',
			0,
			10,
			2
		).clone();
		const hidden = new NumberComponentOption(
			'components.options.index',
			0,
			999,
			0
		)
			.hideFromInspector()
			.clone();

		fixture.componentRef.setInput('config', { visible, hidden });
		fixture.detectChanges();

		const keys = component.configEntries().map(([key]) => key);
		expect(keys).toEqual(['visible']);
	});
});
