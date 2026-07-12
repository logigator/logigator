import { Action } from '../action';
import { SerializedComponent } from '../../components/serialized-component.model';
import { SerializedAction } from '../serialized-action.model';
import { Project } from '../../project/project';
import { Component } from '../../components/component';
import { getStaticDI } from '../../utils/get-di';
import { ComponentProviderService } from '../../components/component-provider.service';
import { LoggingService } from '../../logging/logging.service';

export class RemoveComponentsAction extends Action {
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
      this._components = (components as Component[]).map((c) =>
        Component.serialize(c)
      );
    } else {
      this._components = components as SerializedComponent[];
    }
  }

  serialize(): SerializedAction {
    return { type: 'removeComponents', components: this._components };
  }

  do(project: Project): void {
    for (const component of this._components) {
      project.removeComponent(component.id);
    }
  }

  undo(project: Project): void {
    for (const component of this._components) {
      const config = this.componentProviderService.getComponent(component.type);
      if (!config) {
        this.logging.warn(
          `skipping restore of unresolvable component type ${component.type} (id ${component.id})`,
          'RemoveComponentsAction'
        );
        continue;
      }
      project.addComponent(Component.deserialize(component, config));
    }
  }
}
