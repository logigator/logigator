import { Action } from '../action';
import { SerializedComponent } from '../../components/serialized-component.model';
import { Project } from '../../project/project';
import { Component } from '../../components/component';
import { getStaticDI } from '../../utils/get-di';
import { ComponentProviderService } from '../../components/component-provider.service';

export class RemoveComponentsAction extends Action {
	private readonly _components: SerializedComponent[];

	private readonly componentProviderService = getStaticDI(
		ComponentProviderService
	);

	constructor(...components: Component[]);
	constructor(...components: SerializedComponent[]);
	constructor(...components: Component[] | SerializedComponent[]) {
		super();
		if (components.length > 0 && components[0] instanceof Component) {
			this._components = (components as Component[]).map((c) =>
				Component.serialize(c)
			);
		} else {
			this._components = components as SerializedComponent[];
		}
	}

	do(project: Project): void {
		for (const component of this._components) {
			project.removeComponent(component.id);
		}
	}

	undo(project: Project): void {
		for (const component of this._components) {
			const config = this.componentProviderService.getComponent(component.type);
			if (!config) continue;
			project.addComponent(Component.deserialize(component, config));
		}
	}
}
