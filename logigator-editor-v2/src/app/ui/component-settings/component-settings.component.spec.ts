import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ComponentSettingsComponent } from './component-settings.component';
import { appConfig } from '../../app.config';
import { WorkModeService } from '../../work-mode/work-mode.service';
import { BuiltInComponentType } from '../../components/component-type.enum';

describe('ComponentSettingsComponent', () => {
	let component: ComponentSettingsComponent;
	let fixture: ComponentFixture<ComponentSettingsComponent>;
	let workModeService: WorkModeService;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [ComponentSettingsComponent],
			providers: appConfig.providers
		}).compileComponents();

		workModeService = TestBed.inject(WorkModeService);
		fixture = TestBed.createComponent(ComponentSettingsComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('renders no panel while nothing is being placed or selected', () => {
		const host = fixture.nativeElement as HTMLElement;
		expect(host.querySelector('p-card')).toBeNull();
	});

	it('omits inspector-hidden options from the rendered form', () => {
		// Drive the placement-ghost path with the INPUT plug, whose options are
		// `direction` (select-button), `label` (text-input) and the inspector-hidden
		// `index` (number). The hidden one must not render in the form.
		workModeService.setSelectedComponentType(BuiltInComponentType.INPUT);
		fixture.detectChanges();

		const host = fixture.nativeElement as HTMLElement;
		expect(host.querySelector('p-card')).not.toBeNull();
		expect(host.querySelector('app-text-input-option-input')).not.toBeNull();
		expect(host.querySelector('app-select-button-option-input')).not.toBeNull();
		expect(host.querySelector('app-number-option-input')).toBeNull();
	});
});