import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { setStaticDIInjector } from '../../../utils/get-di';
import { Component } from '../../component';
import { ComponentType } from '../../component-type.enum';
import { outputComponentConfig } from './output.config';
import { OutputComponent } from './output.component';

describe('OutputComponent', () => {
	beforeEach(() => {
		TestBed.configureTestingModule({});
		setStaticDIInjector(TestBed.inject(Injector));
	});

	function create(options: Record<string, unknown> = {}): OutputComponent {
		return Component.deserialize(
			{ pos: [0, 0], options },
			outputComponentConfig
		) as OutputComponent;
	}

	it('has the OUTPUT type id (101)', () => {
		expect(outputComponentConfig.type).toBe(ComponentType.OUTPUT);
	});

	it('exposes exactly one input and no outputs', () => {
		const component = create();
		expect(component.numInputs).toBe(1);
		expect(component.numOutputs).toBe(0);
	});

	it('draws without error (renders children)', () => {
		const component = create({ label: 'Q', index: 0 });
		expect(component.children.length).toBeGreaterThan(0);
	});

	it('tolerates label option changes without error', () => {
		const component = create({ label: 'Q', index: 0 });
		expect(() => (component.options.label.value = 'R')).not.toThrow();
		expect(component.options.label.value).toBe('R');
		expect(component.children.length).toBeGreaterThan(0);
	});
});
