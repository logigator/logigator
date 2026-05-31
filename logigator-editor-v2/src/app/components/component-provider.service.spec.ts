import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { setStaticDIInjector } from '../utils/get-di';
import { ComponentProviderService } from './component-provider.service';
import { ComponentConfig } from './component-config.model';
import { ComponentCategory } from './component-category.enum';
import { ComponentType } from './component-type.enum';
import { Component } from './component';
import { DirectionComponentOption } from './component-options/direction/direction.component-option';

const CUSTOM_TYPE = 1234;

// A minimal config standing in for a runtime-registered custom component. Its
// `create` factory is never invoked by these tests (they exercise only
// registration/lookup), so it returns a placeholder.
function makeStubConfig(): ComponentConfig {
	return {
		type: CUSTOM_TYPE as unknown as ComponentType,
		category: ComponentCategory.USER,
		symbol: 'X',
		name: 'components.def.AND.name',
		description: 'components.def.AND.description',
		options: { direction: new DirectionComponentOption() },
		create: () => ({}) as unknown as Component
	};
}

describe('ComponentProviderService', () => {
	let service: ComponentProviderService;

	beforeEach(() => {
		setStaticDIInjector(TestBed.inject(Injector));
		service = TestBed.inject(ComponentProviderService);
	});

	it('is created', () => {
		expect(service).toBeTruthy();
	});

	it('resolves built-in configs by numeric type id', () => {
		expect(service.getComponent(ComponentType.AND)?.type).toBe(
			ComponentType.AND
		);
		expect(service.getComponent(ComponentType.NOT)?.type).toBe(
			ComponentType.NOT
		);
	});

	it('returns undefined for an unknown type id', () => {
		expect(service.getComponent(999999)).toBeUndefined();
	});

	it('seeds the reactive category lists from the built-ins', () => {
		expect(service.basicComponents().map((c) => c.type)).toEqual(
			jasmine.arrayWithExactContents([ComponentType.NOT, ComponentType.AND])
		);
		expect(service.advancedComponents().map((c) => c.type)).toEqual([
			ComponentType.ROM
		]);
		expect(service.userComponents()).toEqual([]);
		expect(service.ioComponents()).toEqual([]);
	});

	describe('register / unregister', () => {
		it('makes a registered config resolvable by type id', () => {
			const config = makeStubConfig();
			service.register(config);
			expect(service.getComponent(CUSTOM_TYPE)).toBe(config);
		});

		it('surfaces a registered USER config in userComponents() reactively', () => {
			const config = makeStubConfig();
			service.register(config);
			expect(service.userComponents()).toContain(config);
		});

		it('removes a config on unregister', () => {
			const config = makeStubConfig();
			service.register(config);
			service.unregister(CUSTOM_TYPE);
			expect(service.getComponent(CUSTOM_TYPE)).toBeUndefined();
			expect(service.userComponents()).not.toContain(config);
		});

		it('does not disturb built-ins when registering/unregistering customs', () => {
			service.register(makeStubConfig());
			service.unregister(CUSTOM_TYPE);
			expect(service.getComponent(ComponentType.AND)?.type).toBe(
				ComponentType.AND
			);
		});
	});
});
