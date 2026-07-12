import { Action } from '../action';
import { SerializedComponent } from '../../components/serialized-component.model';
import { SerializedAction } from '../serialized-action.model';
import { Project } from '../../project/project';
import { Component } from '../../components/component';
import { getStaticDI } from '../../utils/get-di';
import { ComponentProviderService } from '../../components/component-provider.service';
import { LoggingService } from '../../logging/logging.service';

export class AddComponentsAction extends Action {
  private readonly _components: SerializedComponent[];

  private readonly componentProviderService = getStaticDI(
    ComponentProviderService
  );

  private readonly logging = getStaticDI(LoggingService);

  constructor(...components: Component[]);
  constructor(...components: SerializedComponent[]);
  constructor(...components: Component[] | SerializedComponent[]) {
    super();
    if (components.length > 0 && components[0] instanceof Component) {
      this._components = (components as Component[]).map((component) =>
        Component.serialize(component)
      );
    } else {
      this._components = components as SerializedComponent[];
    }
  }

  serialize(): SerializedAction {
    return { type: 'addComponents', components: this._components };
  }

  do(project: Project): void {
    for (const component of this._components) {
      const config = this.componentProviderService.getComponent(component.type);
      if (!config) {
        this.logging.warn(
          `skipping unresolvable component type ${component.type} (id ${component.id})`,
          'AddComponentsAction'
        );
        continue;
      }
      project.addComponent(Component.deserialize(component, config));
    }
  }

  undo(project: Project): void {
    for (const component of this._components) {
      project.removeComponent(component.id);
    }
  }
}
