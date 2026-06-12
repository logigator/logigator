import { Type } from '@angular/core';
import { Component } from './component';
import type { Project } from '../project/project';

/**
 * What a {@link ComponentAction} renderer operates on: the selected placed
 * component and the project it lives in. Supplied by the settings panel only in
 * placed-instance mode (there is no instance behind a placement ghost).
 */
export interface ComponentActionContext {
  component: Component;
  project: Project;
}

/**
 * A **valueless** action attached to a component type — the action analog of
 * {@link ComponentOption}. A config lists its actions and the settings panel
 * renders each through `*ngComponentOutlet`, exactly as it does options, passing
 * the {@link ComponentActionContext}.
 *
 * Each action pairs with its own renderer component (e.g. a button) that injects
 * whatever it needs and owns its own click handling and visibility, so adding an
 * inspector action is self-contained and never touches the app shell.
 */
export abstract class ComponentAction {
  public abstract readonly renderer: Type<unknown>;
}
