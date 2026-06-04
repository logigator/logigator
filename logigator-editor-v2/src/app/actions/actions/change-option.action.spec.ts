import { ChangeOptionAction } from './change-option.action';
import { ComponentOption } from '../../components/component-option';
import type { Component } from '../../components/component';
import type { Project } from '../../project/project';

class FakeOption extends ComponentOption<number> {
	public readonly label = 'components.options.index' as never;
	public readonly renderer = class {} as never;
	constructor(value: number) {
		super(value);
	}
	protected cloneWithValue(initialValue?: number): ComponentOption<number> {
		return new FakeOption(initialValue ?? this.value);
	}
}

describe('ChangeOptionAction', () => {
	let option: FakeOption;
	let component: Component;
	let project: jasmine.SpyObj<Project>;

	beforeEach(() => {
		option = new FakeOption(1);
		component = { options: { count: option } } as unknown as Component;
		project = jasmine.createSpyObj<Project>('Project', ['getComponentById']);
		project.getComponentById.and.returnValue(component);
	});

	it('do() sets the option to the new value through the setter', () => {
		const action = new ChangeOptionAction(7, 'count', 1, 42);

		action.do(project);

		expect(project.getComponentById).toHaveBeenCalledWith(7);
		expect(option.value).toBe(42);
	});

	it('undo() restores the old value', () => {
		const action = new ChangeOptionAction(7, 'count', 1, 42);

		action.do(project);
		action.undo(project);

		expect(option.value).toBe(1);
	});

	it('writes through the setter so onChange$ fires', () => {
		const action = new ChangeOptionAction(7, 'count', 1, 42);
		const seen: number[] = [];
		option.onChange$.subscribe((v) => seen.push(v));

		action.do(project);

		expect(seen).toEqual([42]);
	});

	it('no-ops when the component is gone', () => {
		project.getComponentById.and.returnValue(undefined);
		const action = new ChangeOptionAction(7, 'count', 1, 42);

		expect(() => action.do(project)).not.toThrow();
	});

	it('no-ops when the option key is absent', () => {
		const action = new ChangeOptionAction(7, 'missing', 1, 42);

		expect(() => action.do(project)).not.toThrow();
		expect(option.value).toBe(1);
	});
});
