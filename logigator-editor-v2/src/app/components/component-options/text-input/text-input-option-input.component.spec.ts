import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TextInputOptionInputComponent } from './text-input-option-input.component';
import { TextInputComponentOption } from './text-input.component-option';
import { appConfig } from '../../../app.config';

describe('TextInputOptionInputComponent', () => {
	let fixture: ComponentFixture<TextInputOptionInputComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TextInputOptionInputComponent],
			providers: appConfig.providers
		}).compileComponents();

		fixture = TestBed.createComponent(TextInputOptionInputComponent);
		fixture.componentRef.setInput(
			'option',
			new TextInputComponentOption('components.options.label', 'A')
		);
		fixture.detectChanges();
	});

	it('creates without error', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});
});
