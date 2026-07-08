import { Type } from '@angular/core';
import { Component } from './component';
import type { Project } from '../project/project';
import type { ComponentConfigView } from './component-config.model';

/**
 * What a {@link ComponentAction} renderer operates on: the component config the
 * action belongs to, plus — in placed-instance mode — the selected instance and
 * its project. The palette/ghost supplies only `config` (there is no instance
 * behind a placement ghost), so `component`/`project` are null there; an action
 * that needs a live instance gates its own visibility on `context.component`.
 */
export interface ComponentActionContext {
  config: ComponentConfigView;
  component: Component | null;
  project: Project | null;
}

/**
 * A **valueless** action attached to a component type — the action analog of
 * {@link ComponentOption}. A config lists its actions and the settings panel
 * renders each through `*ngComponentOutlet`, exactly as it does options, passing
 * the {@link ComponentActionContext}.
 *
 * Each action pairs with its own renderer component (e.g. a button) that injects
 * whatever it needs and owns its own click handling and visibility, so adding an
 * inspector action is self-contained and never touches the app shell. An action
 * that needs a live instance gates itself on `context.component` being non-null
 * (null in palette/ghost mode); a config-scoped action reads only `context.config`.
 */
export abstract class ComponentAction {
  public abstract readonly renderer: Type<unknown>;
}
