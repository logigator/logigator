import { Action } from '../action';
import { SerializedComponent } from '../../components/serialized-component.model';
import { Project } from '../../project/project';
import { Component } from '../../components/component';
import { getStaticDI } from '../../utils/get-di';
import { ComponentProviderService } from '../../components/component-provider.service';

export class AddComponentsAction extends Action {
  private readonly _components: SerializedComponent[];

  private readonly componentProviderService = getStaticDI(
    ComponentProviderService
  );

  constructor(...components: Component[]) {
    super();
    this._components = components.map((component) =>
      Component.serialize(component)
    );
  }

  do(project: Project): void {
    for (const component of this._components) {
      const config = this.componentProviderService.getComponent(component.type);
      if (!config) continue;
      project.addComponent(Component.deserialize(component, config));
    }
  }

  undo(project: Project): void {
    for (const component of this._components) {
      project.removeComponent(component.id);
    }
  }
}
