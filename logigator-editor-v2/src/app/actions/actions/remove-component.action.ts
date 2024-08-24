import { Action } from '../action';
import { SerializedComponent } from '../../components/serialized-component.model';
import { Project } from '../../project/project';
import { Component } from '../../components/component';
import { getStaticDI } from '../../utils/get-di';
import { ComponentProviderService } from '../../components/component-provider.service';

export class RemoveComponentAction extends Action {
	private readonly _componentId: number;
	private readonly _component: SerializedComponent;

	private readonly componentProviderService = getStaticDI(
		ComponentProviderService
	);

	constructor(component: Component) {
		super();
		this._component = Component.serialize(component);
		this._componentId = component.id;
	}

	do(project: Project): void {
		project.removeComponent(this._componentId);
	}

	undo(project: Project): void {
		project.addComponent(
			Component.deserialize(
				this._component,
				this.componentProviderService.getComponent(this._component.t)
			)
		);
	}
}
